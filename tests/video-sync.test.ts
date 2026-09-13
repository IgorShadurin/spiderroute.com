import { test } from "node:test";
import assert from "node:assert/strict";
import { activeVideoAnnotations } from "../src/lib/video-sync";
import type { Annotation } from "../src/lib/types";
const note = (id: string, start?: number, end?: number): Annotation => ({
  id,
  startId: "a",
  endId: "b",
  text: "",
  color: "#38bdf8",
  videoSeconds: start,
  videoEndSeconds: end,
});
test("playback activates point cues and overlapping ranges at exact boundaries", () => {
  const notes = [
    note("plain"),
    note("point", 10),
    note("range", 20, 40),
    note("overlap", 30, 50),
    note("last", 60),
  ];
  for (const time of [null, NaN, -1, 0, 9])
    assert.deepEqual(activeVideoAnnotations(notes, time), []);
  assert.deepEqual(activeVideoAnnotations(notes, 10), ["point"]);
  assert.deepEqual(activeVideoAnnotations(notes, 20), ["range"]);
  assert.deepEqual(activeVideoAnnotations(notes, 30), ["range", "overlap"]);
  assert.deepEqual(activeVideoAnnotations(notes, 40), ["overlap"]);
  assert.deepEqual(activeVideoAnnotations(notes, 50), []);
  assert.deepEqual(activeVideoAnnotations(notes, 60), ["last"]);
  assert.deepEqual(
    activeVideoAnnotations([note("a", 0), note("b", 0), note("c", 5)], 2),
    ["a", "b"],
  );
});
test("highlight preference defaults on, persists independently and rejects non-booleans", async () => {
  const { default: Database } = await import("better-sqlite3");
  const { migratePreferences, updatePreferences } =
    await import("../src/server/preferences");
  const db = new Database(":memory:");
  try {
    db.exec(
      "CREATE TABLE users(id TEXT PRIMARY KEY,locale TEXT); INSERT INTO users VALUES ('a','ru'),('b','en')",
    );
    migratePreferences(db);
    const value = (id: string) =>
      (
        db
          .prepare(
            "SELECT auto_video_highlights AS enabled FROM users WHERE id=?",
          )
          .get(id) as { enabled: number }
      ).enabled;
    assert.equal(value("a"), 1);
    updatePreferences(db, "a", { autoVideoHighlights: false });
    migratePreferences(db);
    assert.equal(value("a"), 0);
    assert.equal(value("b"), 1);
    for (const bad of [0, 1, "false", null])
      assert.throws(() =>
        updatePreferences(db, "a", { autoVideoHighlights: bad }),
      );
    assert.equal(value("a"), 0);
  } finally {
    db.close();
  }
});
