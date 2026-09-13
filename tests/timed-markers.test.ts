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

test("video segments preserve valid ranges and reject incomplete or reversed ranges", () => {
  const segment = {
    ...marker,
    position: undefined,
    startId: "a",
    endId: "c",
    videoEndSeconds: 150,
  };
  const [validated] = validateAnnotations([segment], geometry);
  assert.equal(validated.videoEndSeconds, 150);
  assert.equal(
    publicSnapshot("Ride", geometry, [validated], 0, 0).annotations[0]
      .videoEndSeconds,
    150,
  );
  for (const change of [
    { videoEndSeconds: 90 },
    { videoEndSeconds: 80 },
    { videoEndSeconds: 86401 },
    { videoEndSeconds: 100.5 },
    { videoSeconds: undefined },
    { endId: "a" },
    { position: { lat: 0, lon: 0 } },
  ])
    assert.throws(
      () => validateAnnotations([{ ...segment, ...change }], geometry),
      /invalidAnnotations/,
    );
});

test("video range form requires both times only for timed segments", async () => {
  const { validVideoTimes } = await import("../src/lib/video-time");
  assert.equal(validVideoTimes("", "", false, true), true);
  assert.equal(validVideoTimes("1:30", "2:30", true, true), true);
  assert.equal(validVideoTimes("1:30", "", true, true), false);
  assert.equal(validVideoTimes("1:30", "1:20", false, true), false);
  assert.equal(validVideoTimes("", "2:30", false, true), false);
  assert.equal(validVideoTimes("1:30", "", true, false), true);
});
