import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  distance,
  privacyCircle,
  publicSnapshot,
  smoothSection,
  simplifySection,
  stats,
} from "../src/lib/geo";
import { parseRoute, exportRoute } from "../src/lib/formats";
import type { Geometry } from "../src/lib/types";
const g: Geometry = [
  Array.from({ length: 101 }, (_, i) => ({
    id: "p" + i,
    lat: 0,
    lon: i * 0.001,
    time: "2026-01-01T00:00:00.000Z",
    ele: 12,
    speed: 4,
  })),
];
test("all supported exports round-trip geometry and segment boundaries", () => {
  const multi = [g[0].slice(0, 4), g[0].slice(9, 13)];
  for (const format of ["gpx", "kml", "geojson", "csv"]) {
    const file = exportRoute("A <safe> name", multi, format);
    const parsed = parseRoute(file.body, "test." + file.extension);
    assert.equal(parsed.geometry.length, 2);
    assert.deepEqual(
      parsed.geometry.map((s) => s.map((p) => [p.lat, p.lon])),
      multi.map((s) => s.map((p) => [p.lat, p.lon])),
    );
  }
});
test("rejects XML external entities, invalid coordinates and unsupported files", () => {
  assert.throws(() =>
    parseRoute(
      '<!DOCTYPE x [<!ENTITY x SYSTEM "file:///etc/passwd">]><gpx/>',
      "x.gpx",
    ),
  );
  assert.throws(() =>
    parseRoute('{"type":"LineString","coordinates":[[500,0],[0,1]]}', "x.json"),
  );
  assert.throws(() => parseRoute("x", "x.fit"));
});
test("CSV handles quoted fields and segment changes", () => {
  const p = parseRoute(
    'segment,timestamp,latitude,longitude,activity\n1,,0,0,"ride, road"\n1,,0,1,ride\n2,,2,2,ride\n2,,2,3,ride',
    "x.csv",
  );
  assert.equal(p.geometry.length, 2);
});
test("public snapshot removes private metadata and endpoint coordinates", () => {
  const p = publicSnapshot("A route", g, [], 500, 500);
  assert.ok(p.geometry[0][0].lon > 0);
  assert.ok(p.geometry.at(-1)!.at(-1)!.lon < 0.1);
  for (const s of p.geometry)
    for (const point of s) {
      assert.ok(distance(g[0][0], point) >= 500);
      assert.ok(distance(g[0].at(-1)!, point) >= 500);
      assert.deepEqual(Object.keys(point).sort(), ["id", "lat", "lon"]);
    }
  assert.ok(!JSON.stringify(p).includes("2026-01-01"));
});
test("privacy removes revisits, crossing segments and notes anchored in hidden areas", () => {
  const loop: Geometry = [
    [
      { id: "a", lat: 0, lon: 0 },
      { id: "b", lat: 0, lon: 0.02 },
      { id: "c", lat: 0, lon: -0.02 },
      { id: "d", lat: 0.04, lon: -0.02 },
    ],
  ];
  const p = publicSnapshot(
    "Loop",
    loop,
    [{ id: "n", startId: "a", endId: "b", text: "home", color: "#123456" }],
    500,
    500,
  );
  assert.ok(p.geometry.length >= 2);
  assert.equal(p.annotations.length, 0);
  for (const s of p.geometry)
    for (let i = 1; i < s.length; i++) {
      for (let j = 0; j <= 100; j++) {
        const t = j / 100,
          point = {
            id: "x",
            lat: s[i - 1].lat + (s[i].lat - s[i - 1].lat) * t,
            lon: s[i - 1].lon + (s[i].lon - s[i - 1].lon) * t,
          };
        assert.ok(distance(loop[0][0], point) >= 499);
      }
    }
});
test("fully hidden routes cannot be shared", () =>
  assert.throws(
    () => publicSnapshot("short", [g[0].slice(0, 3)], [], 500, 500),
    /nothingToShare/,
  ));
test("editing preserves endpoints and removes measurements only on moved points", () => {
  const result = smoothSection(g[0].slice(0, 6));
  assert.deepEqual(result[0], g[0][0]);
  assert.deepEqual(result.at(-1), g[0][5]);
  assert.equal(result[2].time, undefined);
  assert.equal(simplifySection(g[0], 2).length, 2);
});
test("share isolation, atomic updates, conflict detection, revocation and independent clones", async () => {
  process.env.DATA_DIR = mkdtempSync(join(tmpdir(), "spiderroute-test-"));
  const { sql } = await import("../src/server/db");
  const service = await import("../src/server/routes");
  try {
    for (const id of ["a", "b"])
      sql
        .prepare("INSERT INTO users(id,email,name,created_at) VALUES(?,?,?,?)")
        .run(id, id + "@example.test", id, new Date().toISOString());
    const r = service.createRoute("a", "Private", g);
    assert.deepEqual(r.privacyCenters, { start: g[0][0], end: g[0].at(-1) });
    assert.throws(() => service.owned(r.id, "b"), /notFound/);
    assert.equal(
      (sql.prepare("SELECT count(*) n FROM shares").get() as any).n,
      0,
    );
    const token = service.publishRoute(r.id, "a", 1);
    assert.equal(token.length, 32);
    const p = service.readShare(token).payload;
    assert.equal("privacyCenters" in p, false);
    const clone = service.cloneRoute(token, "b");
    assert.deepEqual(clone.geometry, p.geometry);
    assert.equal(clone.shared, false);
    const changed = service.saveRoute(r.id, "a", { ...r, title: "Updated" });
    assert.equal(service.readShare(token).payload.title, "Updated");
    const edited = {
      ...service.owned(r.id, "a"),
      geometry: JSON.stringify([g[0].slice(10, 90)]),
    };
    assert.deepEqual(
      service.routeView(edited).privacyCenters,
      r.privacyCenters,
    );
    assert.throws(
      () => service.saveRoute(r.id, "a", { ...r, title: "Stale" }),
      /conflict/,
    );
    assert.throws(
      () => service.saveRoute(r.id, "a", { ...changed, privacyStart: 0 }),
      /privacyConfirmation/,
    );
    sql.prepare("DELETE FROM shares WHERE token=?").run(token);
    assert.throws(() => service.readShare(token), /notFound/);
    assert.equal(service.owned(clone.id, "b").title, "Private");
    const token2 = service.publishRoute(r.id, "a", changed.revision);
    assert.notEqual(token, token2);
    sql.prepare("DELETE FROM routes WHERE id=?").run(r.id);
    assert.throws(() => service.readShare(token2), /notFound/);
    assert.ok(service.owned(clone.id, "b"));
  } finally {
    sql.close();
    rmSync(process.env.DATA_DIR, { recursive: true, force: true });
  }
});

test("privacy preserves long hand-drawn edges outside endpoint zones", () => {
  const route: Geometry = [
    [
      { id: "a", lat: 51.2, lon: 0.8 },
      { id: "b", lat: 47.43827, lon: 9.86816 },
      { id: "c", lat: 44.1, lon: 18.1 },
    ],
  ];
  const snapshot = publicSnapshot("Synthetic long route", route, [], 500, 500);
  assert.ok(snapshot.stats.distance > stats(route).distance - 2500);
  for (const segment of snapshot.geometry)
    for (const point of segment) {
      assert.ok(distance(route[0][0], point) >= 500);
      assert.ok(distance(route[0][2], point) >= 500);
    }
});

test("privacy circles match meter radii at different latitudes and close exactly", () => {
  for (const lat of [0, 51.5, 80])
    for (const radius of [50, 500, 10000]) {
      const center = { id: "center", lat, lon: -0.12 };
      const ring = privacyCircle(center, radius);
      assert.deepEqual(ring[0], ring.at(-1));
      for (const [lon, lat] of ring)
        assert.ok(
          Math.abs(distance(center, { id: "edge", lon, lat }) - radius) < 0.001,
        );
    }
  assert.deepEqual(privacyCircle(g[0][0], 0), []);
});
