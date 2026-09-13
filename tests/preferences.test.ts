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
    assert.deepEqual(user(), { locale: "ru", theme: "light" });
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
    assert.deepEqual(user("b"), { locale: "en", theme: "light" });
    updatePreferences(db, "a", { youtubeChannel: "UC_x5XG1OV2P6uZZ5FSM9Ttw" });
    migratePreferences(db);
    assert.equal(
      (
        db
          .prepare("SELECT youtube_channel AS channel FROM users WHERE id='a'")
          .get() as { channel: string }
      ).channel,
      "UC_x5XG1OV2P6uZZ5FSM9Ttw",
    );
    assert.equal(
      (
        db
          .prepare("SELECT youtube_channel AS channel FROM users WHERE id='b'")
          .get() as { channel: string | null }
      ).channel,
      null,
    );
    assert.throws(() =>
      updatePreferences(db, "a", { locale: "en", youtubeChannel: "evil" }),
    );
    assert.deepEqual(user(), { locale: "ru", theme: "dark" });
  } finally {
    db.close();
  }
});
