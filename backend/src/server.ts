import { createServer, type Server } from "node:http";
import { dirname, join, resolve } from "node:path";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { getRequestListener } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import { WebSocketServer, type WebSocket } from "ws";
import { createApp } from "./app.js";
import { Store } from "./db.js";
import type { WsMessage } from "./types.js";

const here = dirname(fileURLToPath(import.meta.url));

export class Hub {
  private clients = new Set<WebSocket>();

  add(socket: WebSocket) {
    this.clients.add(socket);
    socket.on("close", () => this.clients.delete(socket));
    socket.on("error", () => this.clients.delete(socket));
  }

  broadcast(message: WsMessage) {
    const data = JSON.stringify(message);
    for (const client of this.clients) {
      if (client.readyState === client.OPEN) client.send(data);
    }
  }

  get size() {
    return this.clients.size;
  }
}

function frontendDir() {
  if (process.env.FRONTEND_DIST) return resolve(process.env.FRONTEND_DIST);
  const built = resolve(here, "../../frontend/dist");
  const docker = resolve(here, "../public");
  if (existsSync(join(built, "index.html"))) return built;
  if (existsSync(join(docker, "index.html"))) return docker;
  return null;
}

export async function listen(options: { port: number; dbPath: string; hostname?: string }) {
  const store = new Store(options.dbPath);
  const hub = new Hub();
  const push = () => hub.broadcast({ type: "state", payload: store.snapshot() });
  const app = createApp(store, push);

  const staticRoot = frontendDir();
  if (staticRoot) {
    app.use("/*", serveStatic({ root: staticRoot }));
    app.notFound(async (c) => {
      if (c.req.path.startsWith("/api") || c.req.path === "/health") {
        return c.json({ error: "Ikke funnet" }, 404);
      }
      const html = await readFile(join(staticRoot, "index.html"), "utf8");
      return c.html(html);
    });
  }

  const server = createServer(getRequestListener(app.fetch));
  const wss = new WebSocketServer({ server, path: "/ws" });

  wss.on("connection", (socket) => {
    hub.add(socket);
    const hello: WsMessage = { type: "state", payload: store.snapshot() };
    socket.send(JSON.stringify(hello));
  });

  const ping = setInterval(() => {
    for (const client of wss.clients) {
      if (client.readyState === client.OPEN) client.ping();
    }
  }, 30_000);

  const hostname = options.hostname ?? "0.0.0.0";
  await new Promise<void>((resolveListen, reject) => {
    server.listen(options.port, hostname, () => resolveListen());
    server.on("error", reject);
  });

  const address = server.address();
  const port = typeof address === "object" && address ? address.port : options.port;

  const close = () =>
    new Promise<void>((resolveClose) => {
      clearInterval(ping);
      wss.close();
      store.close();
      server.close(() => resolveClose());
    });

  return { server: server as Server, store, hub, push, port, close };
}
