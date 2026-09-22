import test from "node:test";
import assert from "node:assert/strict";
import { placeInput, placePhotoUrl } from "../src/lib/route-places";

test("places require a title and valid map coordinates, with optional description", () => {
  assert.equal(
    placeInput.safeParse({ title: "  ", lat: 51, lon: 0 }).success,
    false,
  );
  assert.equal(
    placeInput.safeParse({ title: "Lake", lat: 91, lon: 0 }).success,
    false,
  );
  assert.equal(
    placeInput.safeParse({ title: "Lake", lat: 51, lon: Infinity }).success,
    false,
  );
  assert.deepEqual(placeInput.parse({ title: " Lake ", lat: 51, lon: 0 }), {
    icon: "pin",
    title: "Lake",
    description: "",
    lat: 51,
    lon: 0,
  });
  assert.equal(
    placeInput.safeParse({
      title: "Lake",
      lat: 51,
      lon: 0,
      description: "x".repeat(6001),
    }).success,
    false,
  );
});
test("place photos use the active route token only when requested publicly", () => {
  const place = {
    id: "place",
    title: "Lake",
    description: "",
    lat: 51,
    lon: 0,
    photo: "photo.webp",
  };
  assert.equal(placePhotoUrl(place), "/place-photos/place/photo.webp");
  assert.equal(
    placePhotoUrl(place, "public-token"),
    "/place-photos/place/photo.webp?share=public-token",
  );
});

test("place icons accept the ten supported categories and reject arbitrary markup", () => {
  assert.equal(
    placeInput.parse({ title: "Cafe", lat: 0, lon: 0, icon: "coffee" }).icon,
    "coffee",
  );
  assert.equal(
    placeInput.safeParse({ title: "Cafe", lat: 0, lon: 0, icon: "<svg/>" })
      .success,
    false,
  );
});
