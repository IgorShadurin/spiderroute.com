import { test } from "node:test";
import assert from "node:assert/strict";
import Database from "better-sqlite3";
import {
  migrateShortShares,
  reserveShareToken,
} from "../src/server/share-tokens";
test("random short codes retry collisions and retain revoked reservations", () => {
  const db = new Database(":memory:");
  db.pragma("foreign_keys=ON");
  db.exec(
    "CREATE TABLE schema_version(version INTEGER PRIMARY KEY); CREATE TABLE shares(token TEXT PRIMARY KEY,route_id TEXT UNIQUE);",
  );
  migrateShortShares(db);
  const first = reserveShareToken(db);
  assert.match(first, /^[A-Za-z0-9_-]{16}$/);
  const alternative = "z".repeat(16);
  let calls = 0;
  const second = reserveShareToken(db, () =>
    ++calls === 1 ? first : alternative,
  );
  assert.equal(second, alternative);
  assert.equal(calls, 2);
  assert.throws(
    () => reserveShareToken(db, () => first),
    /shareTokenCollision/,
  );
  db.prepare("INSERT INTO shares VALUES(?,?)").run(first, "route");
  db.prepare("INSERT INTO share_links VALUES(?,?)").run(first, "route");
  db.prepare("DELETE FROM shares WHERE route_id=?").run("route");
  assert.equal(
    (db.prepare("SELECT count(*) n FROM share_links").get() as any).n,
    0,
  );
  assert.throws(
    () => reserveShareToken(db, () => first),
    /shareTokenCollision/,
  );
  db.close();
});
