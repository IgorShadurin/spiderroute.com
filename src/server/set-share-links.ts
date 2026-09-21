import type Database from "better-sqlite3";
import { randomBytes } from "node:crypto";

// The reservation outlives public access. item_sets.token is only the active link.
export function migrateSetShareLinks(db: Database.Database) {
  db.transaction(() => {
    db.exec(`CREATE TABLE IF NOT EXISTS item_set_share_links (
      set_id TEXT PRIMARY KEY REFERENCES item_sets(id) ON DELETE CASCADE,
      token TEXT NOT NULL UNIQUE
    )`);
    db.prepare(
      `INSERT OR IGNORE INTO item_set_share_links(set_id,token)
      SELECT id,token FROM item_sets WHERE token IS NOT NULL`,
    ).run();
  }).immediate();
}
export function reserveSetShareLink(db: Database.Database, setId: string) {
  const existing = db
    .prepare("SELECT token FROM item_set_share_links WHERE set_id=?")
    .get(setId) as { token: string } | undefined;
  if (existing) return existing.token;
  for (let attempt = 0; attempt < 10; attempt++) {
    const token = randomBytes(24).toString("base64url");
    if (
      db
        .prepare(
          "INSERT OR IGNORE INTO item_set_share_links(set_id,token) VALUES(?,?)",
        )
        .run(setId, token).changes
    )
      return token;
  }
  throw Error("shareTokenCollision");
}
