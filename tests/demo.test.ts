import { test } from "node:test";
import assert from "node:assert/strict";
import { demoAnnotations } from "../src/lib/demo-annotations";
import { validateAnnotations, publicSnapshot } from "../src/lib/geo";
test("demo has colored segments and point comments that survive endpoint hiding", () => {
  const geometry = [
    Array.from({ length: 700 }, (_, i) => ({
      id: `p${i}`,
      lat: 51.5,
      lon: i * 0.0002,
    })),
  ];
  const notes = demoAnnotations(geometry);
  assert.equal(notes.length, 24);
  assert.equal(notes.filter((n) => n.startId === n.endId).length, 18);
  assert.equal(new Set(notes.map((n) => n.color)).size, 6);
  assert.deepEqual(validateAnnotations(notes, geometry), notes);
  assert.equal(
    publicSnapshot("Demo", geometry, notes, 500, 500).annotations.length,
    24,
  );
});
