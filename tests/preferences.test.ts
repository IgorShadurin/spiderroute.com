import { test } from "node:test";
import assert from "node:assert/strict";
import Database from "better-sqlite3";
import {
  migratePreferences,
  updatePreferences,
} from "../src/server/preferences";
test("theme migration preserves existing accounts and preference updates validate atomically", () => {
  const db = new Database(":memory:");
  try {
    db.exec(
      "CREATE TABLE users(id TEXT PRIMARY KEY,locale TEXT NOT NULL); INSERT INTO users VALUES('a','ru'),('b','en')",
    );
    migratePreferences(db);
    migratePreferences(db);
    const user = (id = "a") =>
      db.prepare("SELECT locale,theme FROM users WHERE id=?").get(id);
    assert.deepEqual(user(), { locale: "ru", theme: "dark" });
    updatePreferences(db, "a", { theme: "light" });
    assert.deepEqual(user(), { locale: "ru", theme: "light" });
    updatePreferences(db, "a", { locale: "en" });
    assert.deepEqual(user(), { locale: "en", theme: "light" });
    for (const bad of [
      { locale: "ru", theme: "invalid" },
      { theme: null },
      { theme: "LIGHT" },
      { theme: [] },
      { unknown: 1 },
      {},
      null,
    ]) {
      assert.throws(() => updatePreferences(db, "a", bad), /invalidFile/);
      assert.deepEqual(user(), { locale: "en", theme: "light" });
    }
    updatePreferences(db, "a", { locale: "ru", theme: "dark" });
    assert.deepEqual(user(), { locale: "ru", theme: "dark" });
    assert.deepEqual(user("b"), { locale: "en", theme: "dark" });
  } finally {
    db.close();
  }
});
