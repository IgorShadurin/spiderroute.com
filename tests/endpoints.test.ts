import { test } from "node:test";
import assert from "node:assert/strict";
import { routeEndpoints, validateEndpoints } from "../src/lib/endpoints";
import { publicSnapshot } from "../src/lib/geo";
const geometry = [
  [
    { id: "a", lat: 0, lon: 0 },
    { id: "b", lat: 0, lon: 0.02 },
    { id: "c", lat: 0, lon: 0.04 },
    { id: "d", lat: 0, lon: 0.06 },
  ],
];
test("endpoint detection handles old routes, multiple segments, times, loops and deleted overrides", () => {
  assert.deepEqual(routeEndpoints(geometry), { startId: "a", endId: "d" });
  assert.deepEqual(
    routeEndpoints([geometry[0].slice(0, 2), geometry[0].slice(2)]),
    { startId: "a", endId: "d" },
  );
  const timed = geometry.map((s) =>
    s.map((p, i) => ({ ...p, time: new Date((4 - i) * 1000).toISOString() })),
  );
  assert.deepEqual(routeEndpoints(timed), { startId: "d", endId: "a" });
  assert.deepEqual(
    routeEndpoints(geometry, { startId: "b", endId: "missing" }),
    { startId: "b", endId: "d" },
  );
  assert.deepEqual(validateEndpoints(geometry, { startId: "b", endId: "b" }), {
    startId: "b",
    endId: "b",
  });
  assert.throws(() =>
    validateEndpoints(geometry, { startId: "foreign", endId: "a" }),
  );
  assert.equal(routeEndpoints([[]]), undefined);
});
test("shared endpoints use public IDs and fall back when custom endpoints are hidden", () => {
  const visible = publicSnapshot(
    "Route",
    geometry,
    [],
    0,
    0,
    undefined,
    undefined,
    1,
    { startId: "b", endId: "c" },
  );
  assert.equal(
    visible.geometry.flat().find((p) => p.id === visible.endpoints?.startId)
      ?.lon,
    0.02,
  );
  assert.equal(
    visible.geometry.flat().find((p) => p.id === visible.endpoints?.endId)?.lon,
    0.04,
  );
  assert.ok(!["a", "b", "c", "d"].includes(visible.endpoints!.startId));
  const hidden = publicSnapshot(
    "Route",
    geometry,
    [],
    500,
    500,
    undefined,
    undefined,
    1,
    { startId: "a", endId: "d" },
  );
  assert.equal(hidden.endpoints!.startId, hidden.geometry[0][0].id);
  assert.equal(hidden.endpoints!.endId, hidden.geometry.at(-1)!.at(-1)!.id);
});
