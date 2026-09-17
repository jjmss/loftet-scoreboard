import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { COOKIE_NAME } from "./app.js";
import { listen } from "./server.js";

function cookieFrom(res: Response) {
  const header = res.headers.get("set-cookie") ?? "";
  const match = header.match(new RegExp(`${COOKIE_NAME}=([^;]+)`));
  return match ? `${COOKIE_NAME}=${match[1]}` : "";
}

test("cookie, lodd, live websocket og fredagsspinn", async () => {
  const dir = mkdtempSync(join(tmpdir(), "loftet-"));
  const { port, close } = await listen({
    port: 0,
    dbPath: join(dir, "test.db"),
    hostname: "127.0.0.1",
  });
  const base = `http://127.0.0.1:${port}`;

  try {
    const health = await fetch(`${base}/health`);
    assert.equal(health.status, 200);

    const adaRes = await fetch(`${base}/api/register`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "Ada" }),
    });
    assert.equal(adaRes.status, 201);
    const adaCookie = cookieFrom(adaRes);
    assert.match(adaCookie, new RegExp(COOKIE_NAME));

    const me = await fetch(`${base}/api/me`, { headers: { cookie: adaCookie } });
    assert.equal((await me.json() as { name: string }).name, "Ada");

    const boRes = await fetch(`${base}/api/register`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "Bo" }),
    });
    const boCookie = cookieFrom(boRes);
    const bo = (await boRes.json()) as { id: string; name: string };

    const wsMessages: unknown[] = [];
    const ws = new WebSocket(`ws://127.0.0.1:${port}/ws`);
    await new Promise<void>((resolve, reject) => {
      ws.addEventListener("open", () => resolve());
      ws.addEventListener("error", () => reject(new Error("ws")));
    });
    ws.addEventListener("message", (event) => {
      wsMessages.push(JSON.parse(String(event.data)));
    });
    await new Promise((r) => setTimeout(r, 50));

    const complete = await fetch(`${base}/api/chores/planter/complete`, {
      method: "POST",
      headers: { cookie: adaCookie },
    });
    assert.equal(complete.status, 200);
    const after = (await complete.json()) as { state: { leaderboard: { name: string; tickets: number }[] } };
    assert.equal(after.state.leaderboard[0]?.name, "Ada");
    assert.equal(after.state.leaderboard[0]?.tickets, 1);

    await new Promise((r) => setTimeout(r, 80));
    const live = wsMessages.find((msg) => {
      const m = msg as { type: string; payload?: { leaderboard: { tickets: number }[] } };
      return m.type === "state" && (m.payload?.leaderboard[0]?.tickets ?? 0) >= 1;
    });
    assert.ok(live, "andre klienter skal få websocket-oppdatering");
    ws.close();

    const ada = (await (await fetch(`${base}/api/me`, { headers: { cookie: adaCookie } })).json()) as {
      id: string;
    };
    const spinRes = await fetch(`${base}/api/friday/spin`, {
      method: "POST",
      headers: { "content-type": "application/json", cookie: boCookie },
      body: JSON.stringify({ attendeeIds: [ada.id, bo.id] }),
    });
    assert.equal(spinRes.status, 200);
    const spun = (await spinRes.json()) as { spin: { winnerId: string; attendeeIds: string[] } };
    assert.ok([ada.id, bo.id].includes(spun.spin.winnerId));
    assert.equal(spun.spin.attendeeIds.length, 2);
  } finally {
    await close();
  }
});
