import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { normalizeYoutube, routePageTitle } from "../src/lib/route-details";
test("route document titles collapse whitespace and cap the name at 60 Unicode characters", () => {
  assert.equal(routePageTitle("  Ride\n  home\t "), "Ride home · SpiderRoute");
  const title = routePageTitle("🚲".repeat(80));
  assert.equal(Array.from(title.split(" · ")[0]).length, 60);
  assert.ok(title.endsWith("… · SpiderRoute"));
});
test("YouTube URL validation normalizes videos and rejects unrelated or executable URLs", () => {
  for (const url of [
    "https://youtu.be/dQw4w9WgXcQ",
    "https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=1",
    "https://youtube.com/shorts/dQw4w9WgXcQ",
  ])
    assert.equal(
      normalizeYoutube(url),
      "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    );
  for (const url of [
    "javascript:alert(1)",
    "https://youtube.com.evil.test/watch?v=dQw4w9WgXcQ",
    "https://youtube.com/watch?v=bad",
    "https://youtube.com@evil.test/watch?v=dQw4w9WgXcQ",
  ])
    assert.throws(() => normalizeYoutube(url), /invalidVideo/);
  assert.equal(normalizeYoutube(""), null);
});
test("video updates persist, validate, update public snapshots, and clone independently", async () => {
  const dir = mkdtempSync(join(tmpdir(), "spiderroute-video-"));
  process.env.DATA_DIR = dir;
  const { sql } = await import("../src/server/db");
  const {
    createRoute,
    saveRoute,
    owned,
    routeView,
    publishRoute,
    readShare,
    cloneRoute,
  } = await import("../src/server/routes");
  try {
    for (const id of ["video-owner", "video-cloner"])
      sql
        .prepare("INSERT INTO users(id,email,name,created_at) VALUES(?,?,?,?)")
        .run(id, id + "@example.test", id, new Date().toISOString());
    let route = createRoute("video-owner", "Video ride", [
      [
        { id: "a", lat: 0, lon: 0 },
        { id: "b", lat: 0, lon: 0.1 },
      ],
    ]);
    route = saveRoute(route.id, "video-owner", {
      ...route,
      youtubeUrl: "https://youtu.be/dQw4w9WgXcQ",
      endpoints: { startId: "b", endId: "a" },
      subscription: { enabled: true, channelId: "UC_x5XG1OV2P6uZZ5FSM9Ttw" },
      privacyStart: 0,
      privacyEnd: 0,
    });
    assert.equal(
      routeView(owned(route.id, "video-owner")).youtubeUrl,
      "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    );
    assert.deepEqual(routeView(owned(route.id, "video-owner")).endpoints, {
      startId: "b",
      endId: "a",
    });
    assert.throws(
      () =>
        saveRoute(route.id, "video-owner", {
          ...route,
          endpoints: { startId: "foreign", endId: "a" },
        }),
      /invalidGeometry/,
    );
    assert.throws(() => owned(route.id, "video-cloner"), /notFound/);
    assert.throws(
      () =>
        saveRoute(route.id, "video-owner", {
          ...route,
          youtubeUrl: "https://evil.test/",
        }),
      /invalidVideo/,
    );
    const token = publishRoute(route.id, "video-owner", route.revision);
    assert.equal(readShare(token).payload.youtubeUrl, route.youtubeUrl);
    assert.deepEqual(readShare(token).payload.subscription, route.subscription);
    const clone = cloneRoute(token, "video-cloner");
    assert.deepEqual(clone.subscription, route.subscription);
    assert.equal(
      clone.geometry.flat().find((p: any) => p.id === clone.endpoints?.startId)
        ?.lon,
      0.1,
    );
    sql.prepare("UPDATE routes SET endpoints=NULL WHERE id=?").run(route.id);
    assert.deepEqual(routeView(owned(route.id, "video-owner")).endpoints, {
      startId: "a",
      endId: "b",
    });
    route = saveRoute(route.id, "video-owner", {
      ...route,
      youtubeUrl: null,
      subscription: { enabled: false, channelId: null },
    });
    assert.equal(readShare(token).payload.subscription?.enabled, false);
    assert.equal(readShare(token).payload.youtubeUrl, null);
    assert.equal(
      routeView(owned(clone.id, "video-cloner")).youtubeUrl,
      clone.youtubeUrl,
    );
  } finally {
    sql.close();
    rmSync(dir, { recursive: true, force: true });
  }
});

test("route titles remove control and direction overrides while retaining plain text", () => {
  assert.equal(
    routePageTitle("  A\u202eB\u0000 C\u200b  "),
    "AB C · SpiderRoute",
  );
  assert.equal(routePageTitle("Cafe\u0301"), "Café · SpiderRoute");
  assert.equal(routePageTitle("  \n\t"), "Route · SpiderRoute");
  assert.equal(
    routePageTitle('Ride <test> & "friends"'),
    'Ride <test> & "friends" · SpiderRoute',
  );
});
