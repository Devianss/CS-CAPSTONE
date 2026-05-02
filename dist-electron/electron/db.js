"use strict";
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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getDb = getDb;
exports.createSession = createSession;
exports.terminateSession = terminateSession;
exports.getActiveSessions = getActiveSessions;
exports.logEvent = logEvent;
exports.getAuditLog = getAuditLog;
exports.getPolicy = getPolicy;
exports.setPolicy = setPolicy;
const better_sqlite3_1 = __importDefault(require("better-sqlite3"));
const path_1 = __importDefault(require("path"));
const electron_1 = require("electron");
// ─────────────────────────────────────────────
//  DB location: <userData>/pcu-lab-portal.db
//  e.g. C:\Users\<user>\AppData\Roaming\pcu-lab-portal\
// ─────────────────────────────────────────────
const DB_PATH = path_1.default.join(electron_1.app.getPath("userData"), "pcu-lab-portal.db");
let _db = null;
function getDb() {
    if (!_db) {
        _db = new better_sqlite3_1.default(DB_PATH, { verbose: console.log });
        migrate(_db);
    }
    return _db;
}
// ─────────────────────────────────────────────
//  Schema migrations (idempotent)
// ─────────────────────────────────────────────
function migrate(db) {
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
function createSession(userId, role, tokenHash, expiresAt) {
    const db = getDb();
    const stmt = db.prepare(`INSERT INTO sessions (user_id, role, token_hash, expires_at)
     VALUES (@userId, @role, @tokenHash, @expiresAt)`);
    const result = stmt.run({ userId, role, tokenHash, expiresAt });
    return result.lastInsertRowid;
}
function terminateSession(sessionId) {
    getDb()
        .prepare("UPDATE sessions SET terminated = 1 WHERE id = ?")
        .run(sessionId);
}
function getActiveSessions(userId) {
    return getDb()
        .prepare(`SELECT * FROM sessions
       WHERE user_id = ? AND terminated = 0 AND expires_at > unixepoch()
       ORDER BY created_at DESC`)
        .all(userId);
}
// ─────────────────────────────────────────────
//  Audit log helpers
// ─────────────────────────────────────────────
function logEvent(eventType, detail, userId, ip) {
    getDb()
        .prepare(`INSERT INTO audit_log (user_id, event_type, detail, ip)
       VALUES (?, ?, ?, ?)`)
        .run(userId ?? null, eventType, detail ?? null, ip ?? null);
}
function getAuditLog(limit = 100, userId) {
    if (userId) {
        return getDb()
            .prepare(`SELECT * FROM audit_log WHERE user_id = ?
         ORDER BY created_at DESC LIMIT ?`)
            .all(userId, limit);
    }
    return getDb()
        .prepare(`SELECT * FROM audit_log ORDER BY created_at DESC LIMIT ?`)
        .all(limit);
}
// ─────────────────────────────────────────────
//  Policy helpers
// ─────────────────────────────────────────────
function getPolicy(key) {
    const row = getDb()
        .prepare("SELECT value FROM policies WHERE key = ?")
        .get(key);
    return row?.value ?? null;
}
function setPolicy(key, value) {
    getDb()
        .prepare(`INSERT INTO policies (key, value, updated_at) VALUES (?, ?, unixepoch())
       ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = unixepoch()`)
        .run(key, value);
}
