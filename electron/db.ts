/**
 * db.ts  –  better-sqlite3 wrapper
 *
 * All DB operations are synchronous (better-sqlite3 design).
 * Import this only from the Electron main process – never from renderer.
 *
 * Tables
 * ──────
 *   sessions   – active/historical login sessions
 *   audit_log  – immutable security event log
 *   policies   – admin-defined access policies
 */

import Database from "better-sqlite3";
import path from "path";
import { app } from "electron";

// ─────────────────────────────────────────────
//  DB location: <userData>/pcu-lab-portal.db
//  e.g. C:\Users\<user>\AppData\Roaming\pcu-lab-portal\
// ─────────────────────────────────────────────
const DB_PATH = path.join(app.getPath("userData"), "pcu-lab-portal.db");

let _db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (!_db) {
    _db = new Database(DB_PATH, { verbose: console.log });
    migrate(_db);
  }
  return _db;
}

// ─────────────────────────────────────────────
//  Schema migrations (idempotent)
// ─────────────────────────────────────────────
function migrate(db: Database.Database): void {
  db.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS sessions (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id     TEXT    NOT NULL,
      role        TEXT    NOT NULL CHECK(role IN ('student','admin')),
      token_hash  TEXT    NOT NULL,
      created_at  INTEGER NOT NULL DEFAULT (unixepoch()),
      expires_at  INTEGER NOT NULL,
      terminated  INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS audit_log (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id     TEXT,
      event_type  TEXT    NOT NULL,
      detail      TEXT,
      ip          TEXT,
      created_at  INTEGER NOT NULL DEFAULT (unixepoch())
    );

    CREATE TABLE IF NOT EXISTS policies (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      key         TEXT    NOT NULL UNIQUE,
      value       TEXT    NOT NULL,
      updated_at  INTEGER NOT NULL DEFAULT (unixepoch())
    );

    CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
    CREATE INDEX IF NOT EXISTS idx_audit_user    ON audit_log(user_id);
    CREATE INDEX IF NOT EXISTS idx_audit_type    ON audit_log(event_type);
  `);
}

// ─────────────────────────────────────────────
//  Session helpers
// ─────────────────────────────────────────────
export interface SessionRow {
  id: number;
  user_id: string;
  role: "student" | "admin";
  token_hash: string;
  created_at: number;
  expires_at: number;
  terminated: number;
}

export function createSession(
  userId: string,
  role: "student" | "admin",
  tokenHash: string,
  expiresAt: number
): number {
  const db = getDb();
  const stmt = db.prepare(
    `INSERT INTO sessions (user_id, role, token_hash, expires_at)
     VALUES (@userId, @role, @tokenHash, @expiresAt)`
  );
  const result = stmt.run({ userId, role, tokenHash, expiresAt });
  return result.lastInsertRowid as number;
}

export function terminateSession(sessionId: number): void {
  getDb()
    .prepare("UPDATE sessions SET terminated = 1 WHERE id = ?")
    .run(sessionId);
}

export function getActiveSessions(userId: string): SessionRow[] {
  return getDb()
    .prepare(
      `SELECT * FROM sessions
       WHERE user_id = ? AND terminated = 0 AND expires_at > unixepoch()
       ORDER BY created_at DESC`
    )
    .all(userId) as SessionRow[];
}

// ─────────────────────────────────────────────
//  Audit log helpers
// ─────────────────────────────────────────────
export function logEvent(
  eventType: string,
  detail?: string,
  userId?: string,
  ip?: string
): void {
  getDb()
    .prepare(
      `INSERT INTO audit_log (user_id, event_type, detail, ip)
       VALUES (?, ?, ?, ?)`
    )
    .run(userId ?? null, eventType, detail ?? null, ip ?? null);
}

export function getAuditLog(
  limit = 100,
  userId?: string
): Record<string, unknown>[] {
  if (userId) {
    return getDb()
      .prepare(
        `SELECT * FROM audit_log WHERE user_id = ?
         ORDER BY created_at DESC LIMIT ?`
      )
      .all(userId, limit) as Record<string, unknown>[];
  }
  return getDb()
    .prepare(`SELECT * FROM audit_log ORDER BY created_at DESC LIMIT ?`)
    .all(limit) as Record<string, unknown>[];
}

// ─────────────────────────────────────────────
//  Policy helpers
// ─────────────────────────────────────────────
export function getPolicy(key: string): string | null {
  const row = getDb()
    .prepare("SELECT value FROM policies WHERE key = ?")
    .get(key) as { value: string } | undefined;
  return row?.value ?? null;
}

export function setPolicy(key: string, value: string): void {
  getDb()
    .prepare(
      `INSERT INTO policies (key, value, updated_at) VALUES (?, ?, unixepoch())
       ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = unixepoch()`
    )
    .run(key, value);
}
