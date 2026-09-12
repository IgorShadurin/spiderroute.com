import test from "node:test";
import assert from "node:assert/strict";
import { validateAnnotations } from "../src/lib/geo";
import { NOTE_MAX_LENGTH, validNoteText } from "../src/lib/note-limits";
const geometry = [[{ id: "p", lat: 51.5, lon: -0.1 }]];
const note = (text: unknown) => [
  { id: "note", startId: "p", endId: "p", color: "#287b5d", text },
];
test("notes enforce the same boundary in the editor and server", () => {
  for (const text of [
    "a".repeat(NOTE_MAX_LENGTH),
    "я".repeat(NOTE_MAX_LENGTH),
    "🚲".repeat(NOTE_MAX_LENGTH / 2),
  ]) {
    assert.equal(validNoteText(text), true);
    assert.equal(validateAnnotations(note(text), geometry)[0].text, text);
    assert.equal(validNoteText(text + "x"), false);
    assert.throws(
      () => validateAnnotations(note(text + "x"), geometry),
      /invalidAnnotations/,
    );
  }
  for (const text of ["", " \n\t ", null, 12]) {
    assert.equal(validNoteText(text), false);
    assert.throws(
      () => validateAnnotations(note(text), geometry),
      /invalidAnnotations/,
    );
  }
  assert.throws(
    () => validateAnnotations([null], geometry),
    /invalidAnnotations/,
  );
});
test("comment text remains literal including markup and line breaks", () => {
  const text = "<script>alert(1)</script>\nA riverside stop";
  assert.equal(validateAnnotations(note(text), geometry)[0].text, text);
});
