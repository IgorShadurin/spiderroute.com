import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

test("route places survive cloning, follow privacy and disappear when access is revoked", async () => {
  const directory = mkdtempSync(join(tmpdir(), "route-places-"));
  process.env.DATA_DIR = directory;
  const { sql } = await import("../src/server/db");
  const {
    createRoute,
    owned,
    routeView,
    snapshot,
    publishRoute,
    readShare,
    revokeShare,
    cloneRoute,
    saveRoute,
  } = await import("../src/server/routes");
  try {
    sql
      .prepare("INSERT INTO users(id,email,name,created_at) VALUES(?,?,?,?)")
      .run("owner", "owner@example.test", "Owner", new Date().toISOString());
    const geometry = [
      Array.from({ length: 100 }, (_, i) => ({
        id: "p" + i,
        lat: 0,
        lon: i * 0.001,
      })),
    ];
    const route = createRoute("owner", "Places test", geometry);
    const add = sql.prepare(
      "INSERT INTO route_places(id,route_id,title,description,lat,lon,photo,created_at) VALUES(?,?,?,?,?,?,?,?)",
    );
    add.run("hidden", route.id, "Home", "secret", 0, 0, null, "2026");
    add.run(
      "visible",
      route.id,
      "Viewpoint",
      "Public description",
      0,
      0.05,
      null,
      "2026",
    );
    sql
      .prepare("UPDATE route_places SET icon=? WHERE id=?")
      .run("coffee", "visible");
    const token = publishRoute(route.id, "owner", route.revision);
    assert.deepEqual(
      readShare(token).payload.places?.map((p) => p.id),
      ["visible"],
    );
    const clone = cloneRoute(token, "owner");
    assert.equal(clone.places.length, 1);
    assert.equal(clone.places[0].title, "Viewpoint");
    assert.equal(clone.places[0].icon, "coffee");
    assert.equal(readShare(token).payload.places?.[0].icon, "coffee");
    assert.notEqual(clone.places[0].id, "visible");
    const loaded = routeView(owned(route.id, "owner"));
    saveRoute(route.id, "owner", {
      ...loaded,
      privacyStart: 0,
      privacyEnd: 0,
      confirmPrivacy: true,
    });
    assert.equal(readShare(token).payload.places?.length, 2);
    revokeShare(route.id, "owner");
    assert.throws(() => readShare(token), /notFound/);
    assert.equal(snapshot(owned(route.id, "owner")).places?.length, 2);
    sql.prepare("DELETE FROM routes WHERE id=?").run(route.id);
    assert.equal(
      (
        sql
          .prepare("SELECT count(*) n FROM route_places WHERE route_id=?")
          .get(route.id) as { n: number }
      ).n,
      0,
    );
  } finally {
    sql.close();
    rmSync(directory, { recursive: true, force: true });
  }
});
