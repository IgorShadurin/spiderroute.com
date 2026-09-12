import { randomBytes } from "node:crypto";
import type Database from "better-sqlite3";

// 96 random bits, encoded without padding. Never derive codes from route IDs.
export function reserveShareToken(
  db: Database.Database,
  generate = () => randomBytes(12).toString("base64url"),
): string {
  for (let attempt = 0; attempt < 10; attempt++) {
    const token = generate();
    if (!/^[A-Za-z0-9_-]{16}$/.test(token)) throw Error("invalidShareToken");
    if (
      db
        .prepare("INSERT OR IGNORE INTO share_token_history(token) VALUES(?)")
        .run(token).changes
    )
      return token;
  }
  throw Error("shareTokenCollision");
}
export function ensureShortShare(
  db: Database.Database,
  routeId: string,
): string {
  return db.transaction(() => {
    const current = db
      .prepare("SELECT token FROM share_links WHERE route_id=?")
      .get(routeId) as { token: string } | undefined;
    if (current) return current.token;
    const token = reserveShareToken(db);
    db.prepare("INSERT INTO share_links(token,route_id) VALUES(?,?)").run(
      token,
      routeId,
    );
    return token;
  })();
}
export function migrateShortShares(db: Database.Database) {
  db.transaction(() => {
    db.exec(`CREATE TABLE IF NOT EXISTS share_token_history(token TEXT PRIMARY KEY);
      CREATE TABLE IF NOT EXISTS share_links(token TEXT PRIMARY KEY,route_id TEXT NOT NULL UNIQUE REFERENCES shares(route_id) ON DELETE CASCADE);`);
    const missing = db
      .prepare(
        "SELECT s.route_id FROM shares s LEFT JOIN share_links l ON l.route_id=s.route_id WHERE l.token IS NULL",
      )
      .all() as { route_id: string }[];
    for (const row of missing) ensureShortShare(db, row.route_id);
    db.prepare("INSERT OR IGNORE INTO schema_version(version) VALUES(2)").run();
  })();
}
