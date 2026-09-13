import test from "node:test";
import assert from "node:assert/strict";
import {
  sortLibrary,
  libraryDate,
  type LibrarySort,
} from "../src/lib/library-sort";
const items = [
  {
    id: "b",
    title: "Б",
    stats: { distance: 200 },
    updatedAt: "2026-09-12T10:00:00Z",
  },
  {
    id: "a",
    title: "А",
    stats: { distance: 100 },
    updatedAt: "2026-09-13T10:00:00Z",
  },
];
test("all six sort directions work without changing source order", () => {
  for (const [sort, ids] of [
    ["date-desc", "ab"],
    ["date-asc", "ba"],
    ["distance-asc", "ab"],
    ["distance-desc", "ba"],
    ["name-asc", "ab"],
    ["name-desc", "ba"],
  ] as [LibrarySort, string][])
    assert.equal(
      sortLibrary(items, sort, "ru")
        .map((i) => i.id)
        .join(""),
      ids,
    );
  assert.equal(items.map((i) => i.id).join(""), "ba");
});
test("unavailable favorites remain last and missing dates render safely", () => {
  const favorites = [{ id: "gone", available: false }, ...items];
  for (const sort of [
    "date-desc",
    "date-asc",
    "name-asc",
    "name-desc",
    "distance-asc",
    "distance-desc",
  ] as LibrarySort[])
    assert.equal(sortLibrary(favorites, sort, "en").at(-1)?.id, "gone");
  assert.equal(libraryDate(undefined, "ru"), "—");
  assert.equal(libraryDate("invalid", "en"), "—");
  assert.match(libraryDate(items[0].updatedAt, "ru"), /12\.09\.26/);
});
