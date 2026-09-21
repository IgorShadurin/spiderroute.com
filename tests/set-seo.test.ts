import test from "node:test";
import assert from "node:assert/strict";
import {
  setSeoTitle,
  setDescription,
  type ItemSet,
} from "../src/lib/item-sets";
const set: ItemSet = {
  id: "s",
  token: null,
  title: "Weekend kit",
  description: "",
  metaTitle: "",
  metaDescription: "",
  locale: "en",
  createdAt: "",
  updatedAt: "",
  items: [],
};
test("automatic set metadata stays useful without advanced settings and tracks content", () => {
  assert.equal(setSeoTitle(set), "Weekend kit · SpiderRoute");
  assert.match(setDescription(set), /Weekend kit.*collection/);
  assert.equal(
    setDescription({ ...set, description: "  A useful\n  collection. " }),
    "A useful collection.",
  );
  assert.match(
    setDescription({ ...set, locale: "ru", title: "Велопоездка" }),
    /Велопоездка.*подборка/,
  );
  assert.equal(
    setSeoTitle({ ...set, title: "Updated kit" }),
    "Updated kit · SpiderRoute",
  );
  assert.ok(
    setSeoTitle({ ...set, title: "Long title ".repeat(20) }).length <= 70,
  );
  assert.ok(
    setDescription({ ...set, description: "Long description ".repeat(30) })
      .length <= 160,
  );
  assert.equal(
    setSeoTitle({ ...set, metaTitle: "My custom title" }),
    "My custom title",
  );
  assert.equal(
    setDescription({ ...set, metaDescription: "My custom description" }),
    "My custom description",
  );
  assert.match(
    setDescription({ ...set, metaDescription: "   " }),
    /Weekend kit/,
  );
  assert.match(
    setDescription({
      ...set,
      items: [
        {
          id: "i",
          title: "Helmet",
          description: "",
          wb: "",
          ozon: "",
          amazon: "",
          ebay: "",
          links: [],
          photo: null,
        },
      ],
    }),
    /Helmet/,
  );
});
