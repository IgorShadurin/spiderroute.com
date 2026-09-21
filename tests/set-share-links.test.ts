import { test } from "node:test";
import assert from "node:assert/strict";
import Database from "better-sqlite3";
import {
  migrateSetShareLinks,
  reserveSetShareLink,
} from "../src/server/set-share-links";

test("existing public set URLs survive migration, revocation and migration reruns", () => {
  const db = new Database(":memory:");
  db.pragma("foreign_keys=ON");
  db.exec("CREATE TABLE item_sets(id TEXT PRIMARY KEY,token TEXT UNIQUE)");
  const token = "a".repeat(32);
  db.prepare("INSERT INTO item_sets VALUES(?,?)").run("published", token);
  db.prepare("INSERT INTO item_sets VALUES(?,NULL)").run("private");
  migrateSetShareLinks(db);
  assert.equal(reserveSetShareLink(db, "published"), token);
  db.prepare("UPDATE item_sets SET token=NULL WHERE id=?").run("published");
  migrateSetShareLinks(db);
  assert.equal(reserveSetShareLink(db, "published"), token);
  assert.equal(
    (
      db
        .prepare("SELECT token FROM item_sets WHERE id=?")
        .get("published") as any
    ).token,
    null,
  );
  const second = reserveSetShareLink(db, "private");
  assert.match(second, /^[A-Za-z0-9_-]{32}$/);
  assert.notEqual(second, token);
  assert.equal(reserveSetShareLink(db, "private"), second);
  db.prepare("DELETE FROM item_sets WHERE id=?").run("published");
  assert.equal(
    db
      .prepare("SELECT token FROM item_set_share_links WHERE set_id=?")
      .get("published"),
    undefined,
  );
  db.close();
});
