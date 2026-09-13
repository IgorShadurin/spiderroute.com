import test from "node:test";
import assert from "node:assert/strict";
import { validateAnnotations, publicSnapshot } from "../src/lib/geo";
import { parseVideoTime, formatVideoTime } from "../src/lib/video-time";
const geometry = [
  [
    { id: "a", lat: 0, lon: 0 },
    { id: "b", lat: 0, lon: 0.01 },
    { id: "c", lat: 0, lon: 0.02 },
  ],
];
const marker = {
  id: "note",
  startId: "b",
  endId: "b",
  text: "Bridge",
  color: "#ed704c",
  position: { lat: 0.001, lon: 0.01 },
  videoSeconds: 90,
};
test("timestamp input accepts seconds and colon times with bounded validation", () => {
  for (const [input, expected] of [
    ["90", 90],
    ["1:30", 90],
    ["1:02:03", 3723],
    ["0:00", 0],
    ["24:00:00", 86400],
  ] as const)
    assert.equal(parseVideoTime(input), expected);
  for (const input of ["", "-1", "1:60", "x", "1.5", "24:00:01", "999999"])
    assert.equal(parseVideoTime(input), undefined);
  assert.equal(formatVideoTime(90), "1:30");
});
test("independent marker location and timing survive validation and sharing", () => {
  assert.deepEqual(validateAnnotations([marker], geometry), [marker]);
  const shared = publicSnapshot("Ride", geometry, [marker], 0, 0);
  assert.deepEqual(shared.annotations[0].position, marker.position);
  assert.equal(shared.annotations[0].videoSeconds, 90);
  assert.deepEqual(
    geometry[0].map((p) => p.id),
    ["a", "b", "c"],
  );
  for (const bad of [
    { videoSeconds: -1 },
    { videoSeconds: 1.5 },
    { videoSeconds: 86401 },
    { videoSeconds: "90" },
    { position: { lat: NaN, lon: 0 } },
    { position: { lat: 0, lon: 181 } },
  ])
    assert.throws(
      () => validateAnnotations([{ ...marker, ...bad }], geometry),
      /invalidAnnotations/,
    );
});
test("off-route pins inside private endpoint circles never enter public snapshots", () => {
  const hidden = { ...marker, position: { lat: 0, lon: 0.0001 } };
  const shared = publicSnapshot("Ride", geometry, [hidden], 100, 0);
  assert.equal(shared.annotations.length, 0);
});
