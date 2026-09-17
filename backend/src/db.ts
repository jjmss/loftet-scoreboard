import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { randomUUID } from "node:crypto";
import { DatabaseSync } from "node:sqlite";
import { pickWinner } from "./spin.js";
import {
  FIXED_CHORES,
  type Activity,
  type Chore,
  type FridaySpin,
  type LeaderboardEntry,
  type Snapshot,
  type User,
} from "./types.js";

function asRecord(row: unknown): Record<string, unknown> | null {
  if (!row || typeof row !== "object") return null;
  return { ...(row as Record<string, unknown>) };
}

export class Store {
  private db: DatabaseSync;

  constructor(dbPath: string) {
    if (dbPath !== ":memory:") {
      mkdirSync(dirname(dbPath), { recursive: true });
    }
    this.db = new DatabaseSync(dbPath);
    this.db.exec("PRAGMA journal_mode = WAL");
    this.db.exec("PRAGMA foreign_keys = ON");
    this.migrate();
  }

  close() {
    this.db.close();
  }

  private migrate() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL UNIQUE COLLATE NOCASE,
        created_at INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS chores (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        emoji TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS completions (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id),
        chore_id TEXT NOT NULL REFERENCES chores(id),
        tickets INTEGER NOT NULL DEFAULT 1,
        created_at INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS friday_spins (
        id TEXT PRIMARY KEY,
        winner_id TEXT NOT NULL REFERENCES users(id),
        attendee_ids TEXT NOT NULL,
        spun_at INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_completions_user ON completions(user_id);
      CREATE INDEX IF NOT EXISTS idx_completions_created ON completions(created_at DESC);
    `);

    const insert = this.db.prepare(
      "INSERT OR IGNORE INTO chores (id, name, emoji) VALUES (?, ?, ?)",
    );
    for (const chore of FIXED_CHORES) {
      insert.run(chore.id, chore.name, chore.emoji);
    }
  }

  createUser(name: string): User {
    const user: User = { id: randomUUID(), name, createdAt: Date.now() };
    this.db
      .prepare("INSERT INTO users (id, name, created_at) VALUES (?, ?, ?)")
      .run(user.id, user.name, user.createdAt);
    return user;
  }

  getUser(id: string): User | null {
    const row = asRecord(
      this.db.prepare("SELECT id, name, created_at AS createdAt FROM users WHERE id = ?").get(id),
    );
    if (!row) return null;
    return { id: String(row.id), name: String(row.name), createdAt: Number(row.createdAt) };
  }

  listChores(): Chore[] {
    return this.db
      .prepare("SELECT id, name, emoji FROM chores ORDER BY rowid")
      .all()
      .map((row) => {
        const r = asRecord(row)!;
        return { id: String(r.id), name: String(r.name), emoji: String(r.emoji) };
      });
  }

  completeChore(userId: string, choreId: string): Activity {
    const user = this.getUser(userId);
    if (!user) throw new Error("Ukjent bruker");
    const chore = this.listChores().find((item) => item.id === choreId);
    if (!chore) throw new Error("Ukjent oppgave");

    const activity: Activity = {
      id: randomUUID(),
      userId: user.id,
      userName: user.name,
      choreId: chore.id,
      choreName: chore.name,
      choreEmoji: chore.emoji,
      tickets: 1,
      createdAt: Date.now(),
    };
    this.db
      .prepare(
        "INSERT INTO completions (id, user_id, chore_id, tickets, created_at) VALUES (?, ?, ?, ?, ?)",
      )
      .run(activity.id, activity.userId, activity.choreId, activity.tickets, activity.createdAt);
    return activity;
  }

  leaderboard(): LeaderboardEntry[] {
    return this.db
      .prepare(
        `SELECT u.id, u.name, COALESCE(SUM(c.tickets), 0) AS tickets
         FROM users u
         LEFT JOIN completions c ON c.user_id = u.id
         GROUP BY u.id
         ORDER BY tickets DESC, u.name COLLATE NOCASE ASC`,
      )
      .all()
      .map((row) => {
        const r = asRecord(row)!;
        return { id: String(r.id), name: String(r.name), tickets: Number(r.tickets) };
      });
  }

  activity(limit = 20): Activity[] {
    return this.db
      .prepare(
        `SELECT
           c.id,
           c.user_id AS userId,
           u.name AS userName,
           c.chore_id AS choreId,
           ch.name AS choreName,
           ch.emoji AS choreEmoji,
           c.tickets,
           c.created_at AS createdAt
         FROM completions c
         JOIN users u ON u.id = c.user_id
         JOIN chores ch ON ch.id = c.chore_id
         ORDER BY c.created_at DESC
         LIMIT ?`,
      )
      .all(limit)
      .map((row) => {
        const r = asRecord(row)!;
        return {
          id: String(r.id),
          userId: String(r.userId),
          userName: String(r.userName),
          choreId: String(r.choreId),
          choreName: String(r.choreName),
          choreEmoji: String(r.choreEmoji),
          tickets: Number(r.tickets),
          createdAt: Number(r.createdAt),
        };
      });
  }

  recordSpin(attendeeIds: string[]): FridaySpin {
    const unique = [...new Set(attendeeIds)];
    if (unique.length === 0) throw new Error("Merk minst én som er til stede");

    const people = unique.map((id) => {
      const user = this.getUser(id);
      if (!user) throw new Error("Ukjent deltaker");
      return user;
    });

    const winner = pickWinner(people);
    const spin: FridaySpin = {
      id: randomUUID(),
      winnerId: winner.id,
      winnerName: winner.name,
      attendeeIds: people.map((p) => p.id),
      attendeeNames: people.map((p) => p.name),
      spunAt: Date.now(),
    };
    this.db
      .prepare(
        "INSERT INTO friday_spins (id, winner_id, attendee_ids, spun_at) VALUES (?, ?, ?, ?)",
      )
      .run(spin.id, spin.winnerId, JSON.stringify(spin.attendeeIds), spin.spunAt);
    return spin;
  }

  latestSpin(): FridaySpin | null {
    const row = asRecord(
      this.db
        .prepare(
          `SELECT s.id, s.winner_id AS winnerId, u.name AS winnerName, s.attendee_ids AS attendeeIds, s.spun_at AS spunAt
           FROM friday_spins s
           JOIN users u ON u.id = s.winner_id
           ORDER BY s.spun_at DESC
           LIMIT 1`,
        )
        .get(),
    );
    if (!row) return null;
    const attendeeIds = JSON.parse(String(row.attendeeIds)) as string[];
    const attendeeNames = attendeeIds.map((id) => this.getUser(id)?.name ?? "Ukjent");
    return {
      id: String(row.id),
      winnerId: String(row.winnerId),
      winnerName: String(row.winnerName),
      attendeeIds,
      attendeeNames,
      spunAt: Number(row.spunAt),
    };
  }

  snapshot(): Snapshot {
    return {
      chores: this.listChores(),
      leaderboard: this.leaderboard(),
      activity: this.activity(),
      latestSpin: this.latestSpin(),
    };
  }
}
