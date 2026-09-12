import { test } from "node:test";
import assert from "node:assert/strict";
import Database from "better-sqlite3";
import { overviewGeometry, routeOverview } from "../src/server/overview";
import { resolveTheme } from "../src/lib/theme";
test("overview preserves segment endpoints, reduces detail, and never leaks another owner's routes", () => {
  const geometry = [
    Array.from({ length: 10000 }, (_, i) => ({
      id: String(i),
      lat: 51 + i / 100000,
      lon: -0.1,
      ele: 100,
      time: "private-time",
    })),
    [
      { id: "end-a", lat: 52, lon: 0 },
      { id: "end-b", lat: 53, lon: 1 },
    ],
  ];
  const original = JSON.stringify(geometry),
    preview = overviewGeometry(geometry);
  assert.equal(preview.length, 2);
  assert.equal(preview[0][0].id, "0");
  assert.equal(preview[0].at(-1)?.id, "9999");
  assert.equal(preview[1].length, 2);
  assert.ok(preview.flat().length < 2100);
  assert.equal(JSON.stringify(geometry), original);
  assert.deepEqual(Object.keys(preview[0][0]).sort(), ["id", "lat", "lon"]);
  const db = new Database(":memory:");
  try {
    db.exec(
      "CREATE TABLE routes(id TEXT,user_id TEXT,title TEXT,geometry TEXT,stats TEXT)",
    );
    const insert = db.prepare("INSERT INTO routes VALUES(?,?,?,?,?)");
    insert.run("mine", "a", "My route", original, '{"distance":2000}');
    insert.run("other", "b", "Secret", original, '{"distance":3000}');
    assert.deepEqual(
      routeOverview(db, "a", ["mine", "other"]).map((r) => r.id),
      ["mine"],
    );
    assert.deepEqual(routeOverview(db, "a", ["other"]), []);
    assert.throws(
      () => routeOverview(db, "a", Array(21).fill("mine")),
      /invalidFile/,
    );
  } finally {
    db.close();
  }
  assert.equal(resolveTheme(undefined), "light");
  assert.equal(resolveTheme("invalid"), "light");
  assert.equal(resolveTheme("dark"), "dark");
});
