import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
export const dataDir = process.env.DATA_DIR || join(process.cwd(), "data");
mkdirSync(dataDir, { recursive: true, mode: 0o700 });
export const sql = new Database(join(dataDir, "spiderroute.sqlite"));
sql.pragma("journal_mode = WAL");
sql.pragma("foreign_keys = ON");
sql.pragma("busy_timeout = 5000");
export const db = drizzle(sql);
sql.exec(`
CREATE TABLE IF NOT EXISTS schema_version(version INTEGER PRIMARY KEY);
INSERT OR IGNORE INTO schema_version VALUES(1);
CREATE TABLE IF NOT EXISTS users(id TEXT PRIMARY KEY,email TEXT NOT NULL UNIQUE,name TEXT NOT NULL,locale TEXT NOT NULL DEFAULT 'en',password_hash TEXT,is_demo INTEGER NOT NULL DEFAULT 0,disabled INTEGER NOT NULL DEFAULT 0,created_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS identities(provider TEXT NOT NULL,subject TEXT NOT NULL,user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,PRIMARY KEY(provider,subject));
CREATE TABLE IF NOT EXISTS routes(id TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,title TEXT NOT NULL,geometry TEXT NOT NULL,original TEXT NOT NULL,annotations TEXT NOT NULL DEFAULT '[]',stats TEXT NOT NULL,revision INTEGER NOT NULL DEFAULT 1,privacy_start INTEGER NOT NULL DEFAULT 500,privacy_end INTEGER NOT NULL DEFAULT 500,updated_at TEXT NOT NULL);
CREATE INDEX IF NOT EXISTS routes_owner ON routes(user_id,updated_at DESC);
CREATE TABLE IF NOT EXISTS shares(token TEXT PRIMARY KEY,route_id TEXT NOT NULL UNIQUE REFERENCES routes(id) ON DELETE CASCADE,payload TEXT NOT NULL,revision INTEGER NOT NULL,created_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS favorites(user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,route_id TEXT NOT NULL REFERENCES routes(id) ON DELETE CASCADE,PRIMARY KEY(user_id,route_id));
CREATE TABLE IF NOT EXISTS rate_limits(key TEXT PRIMARY KEY,count INTEGER NOT NULL,expires INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS outbox(id TEXT PRIMARY KEY,recipient TEXT NOT NULL,subject TEXT NOT NULL,body TEXT NOT NULL,status TEXT NOT NULL DEFAULT 'pending',attempts INTEGER NOT NULL DEFAULT 0,next_at INTEGER NOT NULL DEFAULT 0,provider_id TEXT,created_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS delivery_events(id TEXT PRIMARY KEY,event TEXT NOT NULL,message_id TEXT,created_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS suppressions(email TEXT PRIMARY KEY,reason TEXT NOT NULL);
`);
export function rateLimit(key: string, limit: number, window = 60): boolean {
  const now = Math.floor(Date.now() / 1000);
  return sql.transaction(() => {
    sql.prepare("DELETE FROM rate_limits WHERE expires < ?").run(now);
    const row = sql
      .prepare("SELECT count FROM rate_limits WHERE key=?")
      .get(key) as { count: number } | undefined;
    if (row && row.count >= limit) return false;
    sql
      .prepare(
        "INSERT INTO rate_limits VALUES(?,1,?) ON CONFLICT(key) DO UPDATE SET count=count+1",
      )
      .run(key, now + window);
    return true;
  })();
}
