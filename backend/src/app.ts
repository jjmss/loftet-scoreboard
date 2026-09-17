import { Hono } from "hono";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import type { Store } from "./db.js";
import { normalizeName } from "./spin.js";

export const COOKIE_NAME = "loftet_uid";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

type Variables = { userId: string | null };

function cookieSecure(c: { req: { header: (name: string) => string | undefined } }) {
  if (process.env.COOKIE_SECURE === "true") return true;
  if (process.env.COOKIE_SECURE === "false") return false;
  return c.req.header("x-forwarded-proto") === "https";
}

function cookieOpts(c: { req: { header: (name: string) => string | undefined } }) {
  return {
    path: "/",
    httpOnly: true,
    sameSite: "Lax" as const,
    maxAge: COOKIE_MAX_AGE,
    secure: cookieSecure(c),
  };
}

function errorStatus(message: string) {
  if (message.includes("opptatt") || message.includes("UNIQUE")) return 409;
  if (message === "Ikke innlogget" || message === "Ukjent bruker") return 401;
  if (message.includes("Ukjent")) return 404;
  return 400;
}

export function createApp(store: Store, onChange: () => void) {
  const app = new Hono<{ Variables: Variables }>();

  app.use("*", async (c, next) => {
    const userId = getCookie(c, COOKIE_NAME) ?? null;
    c.set("userId", userId);
    await next();
  });

  app.get("/health", (c) => c.json({ ok: true }));

  app.get("/api/me", (c) => {
    const userId = c.get("userId");
    if (!userId) return c.json({ error: "Ikke innlogget" }, 401);
    const user = store.getUser(userId);
    if (!user) return c.json({ error: "Ikke innlogget" }, 401);
    return c.json(user);
  });

  app.get("/api/state", (c) => c.json(store.snapshot()));

  app.post("/api/register", async (c) => {
    const existingId = c.get("userId");
    if (existingId) {
      const existing = store.getUser(existingId);
      if (existing) return c.json(existing);
    }

    let body: unknown;
    try {
      body = await c.req.json();
    } catch {
      return c.json({ error: "Ugyldig JSON" }, 400);
    }
    const name = normalizeName((body as { name?: unknown }).name);

    try {
      const user = store.createUser(name);
      setCookie(c, COOKIE_NAME, user.id, cookieOpts(c));
      onChange();
      return c.json(user, 201);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Kunne ikke registrere";
      if (message.includes("UNIQUE")) {
        return c.json({ error: "Navnet er opptatt" }, 409);
      }
      return c.json({ error: message }, errorStatus(message));
    }
  });

  app.post("/api/logout", (c) => {
    deleteCookie(c, COOKIE_NAME, { path: "/" });
    return c.json({ ok: true });
  });

  app.post("/api/chores/:id/complete", (c) => {
    const userId = c.get("userId");
    if (!userId || !store.getUser(userId)) {
      return c.json({ error: "Ikke innlogget" }, 401);
    }
    try {
      const activity = store.completeChore(userId, c.req.param("id"));
      onChange();
      return c.json({ activity, state: store.snapshot() });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Kunne ikke loggføre";
      return c.json({ error: message }, errorStatus(message));
    }
  });

  app.post("/api/friday/spin", async (c) => {
    const userId = c.get("userId");
    if (!userId || !store.getUser(userId)) {
      return c.json({ error: "Ikke innlogget" }, 401);
    }
    let body: unknown;
    try {
      body = await c.req.json();
    } catch {
      return c.json({ error: "Ugyldig JSON" }, 400);
    }
    const attendeeIds = (body as { attendeeIds?: unknown }).attendeeIds;
    if (!Array.isArray(attendeeIds) || attendeeIds.some((id) => typeof id !== "string")) {
      return c.json({ error: "Velg hvem som er til stede" }, 400);
    }
    try {
      const spin = store.recordSpin(attendeeIds);
      onChange();
      return c.json({ spin, state: store.snapshot() });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Kunne ikke spinne";
      return c.json({ error: message }, errorStatus(message));
    }
  });

  return app;
}
