import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import sharp from "sharp";
import { itemInput, marketplaceUrl } from "../src/lib/item-sets";

test("sets remain owner-only until shared; revoke preserves the reserved link and protects photos; deletion cleans storage", async () => {
  const dir = mkdtempSync(join(tmpdir(), "spiderroute-sets-"));
  process.env.DATA_DIR = dir;
  const service = await import("../src/server/item-sets");
  const { sql } = await import("../src/server/db");
  try {
    for (const id of ["owner", "other"])
      sql
        .prepare("INSERT INTO users(id,email,name,created_at) VALUES(?,?,?,?)")
        .run(id, id + "@example.test", id, new Date().toISOString());
    let set = service.saveSet("owner", { title: "Weekend kit", locale: "en" });
    assert.equal(set.token, null);
    assert.equal(service.listSets("other").length, 0);
    assert.throws(() => service.ownedSet(set.id, "other"), /notFound/);
    assert.throws(
      () => service.saveSet("other", { title: "Hijacked" }, set.id),
      /notFound/,
    );
    assert.throws(() => service.deleteSet(set.id, "other"), /notFound/);
    assert.throws(
      () => service.setVisibility(set.id, "other", true),
      /notFound/,
    );
    assert.throws(
      () => service.setVisibility(set.id, "owner", true),
      /emptySet/,
    );
    set = service.saveItem(set.id, "owner", {
      title: "Helmet",
      wb: "123456",
      ozon: "https://www.ozon.ru/product/1234/",
      links: [
        { label: "Brand", url: "https://example.com/helmet" },
        { label: "Review", url: "https://example.com/review" },
      ],
    });
    const id = set.items[0].id;
    assert.throws(
      () => service.saveItem(set.id, "owner", { title: "No link" }),
      /linkRequired/,
    );
    assert.throws(
      () =>
        service.saveItem(set.id, "owner", { title: "Remove last link" }, id),
      /linkRequired/,
    );
    assert.equal(service.ownedSet(set.id, "owner").items[0].wb, "123456");

    const photo = await sharp({
      create: { width: 120, height: 80, channels: 3, background: "#d5ff39" },
    })
      .png()
      .toBuffer();
    await assert.rejects(
      () => service.saveItemPhoto(set.id, "other", id, photo),
      /notFound/,
    );
    await assert.rejects(
      () =>
        service.saveItemPhoto(
          set.id,
          "owner",
          id,
          Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"></svg>'),
        ),
      /invalidImage/,
    );
    await assert.rejects(
      () =>
        service.saveItemPhoto(
          set.id,
          "owner",
          id,
          Buffer.alloc(8 * 1024 * 1024 + 1),
        ),
      /fileTooLarge/,
    );
    set = await service.saveItemPhoto(set.id, "owner", id, photo);
    const first = set.items[0].photo!;
    assert.equal(
      (await sharp(service.readItemPhoto(id, first, "owner")).metadata())
        .format,
      "webp",
    );
    assert.throws(() => service.readItemPhoto(id, first), /notFound/);
    assert.throws(() => service.readItemPhoto(id, first, "other"), /notFound/);
    assert.equal(service.publicSetsForSitemap().length, 0);
    set = service.setVisibility(set.id, "owner", true);
    const token = set.token!;
    assert.equal(service.publicSet(token).items.length, 1);
    assert.equal(service.publicSetsForSitemap().length, 1);
    assert.ok(service.readItemPhoto(id, first, undefined, token));
    service.setVisibility(set.id, "owner", false);
    assert.throws(() => service.publicSet(token), /notFound/);
    assert.throws(
      () => service.readItemPhoto(id, first, undefined, token),
      /notFound/,
    );
    assert.equal(service.publicSetsForSitemap().length, 0);
    set = service.setVisibility(set.id, "owner", true);
    assert.equal(set.token, token);
    assert.equal(service.publicSet(token).items[0].id, id);
    assert.ok(service.readItemPhoto(id, first, undefined, token));
    assert.equal(service.publicSetsForSitemap()[0].token, token);
    for (let cycle = 0; cycle < 3; cycle++) {
      assert.equal(service.setVisibility(set.id, "owner", true).token, token);
      assert.equal(service.setVisibility(set.id, "owner", false).token, null);
      assert.equal(service.setVisibility(set.id, "owner", false).token, null);
      assert.equal(service.ownedSet(set.id, "owner").items.length, 1);
      assert.ok(service.readItemPhoto(id, first, "owner"));
      assert.throws(() => service.publicSet(token), /notFound/);
      assert.throws(
        () => service.readItemPhoto(id, first, "other", token),
        /notFound/,
      );
      assert.equal(service.setVisibility(set.id, "owner", true).token, token);
    }
    set = await service.saveItemPhoto(set.id, "owner", id, photo);
    assert.notEqual(set.items[0].photo, first);
    assert.deepEqual(readdirSync(join(dir, "set-photos")), [
      set.items[0].photo,
    ]);
    assert.throws(() => service.readItemPhoto(id, first, "owner"), /notFound/);
    assert.throws(() => service.deleteItem(set.id, "other", id), /notFound/);
    service.deleteItemPhoto(set.id, "owner", id);
    assert.equal(readdirSync(join(dir, "set-photos")).length, 0);
    set = await service.saveItemPhoto(set.id, "owner", id, photo);
    service.deleteItem(set.id, "owner", id);
    assert.equal(readdirSync(join(dir, "set-photos")).length, 0);
    set = service.saveItem(set.id, "owner", { title: "Bag", wb: "123" });
    set = await service.saveItemPhoto(set.id, "owner", set.items[0].id, photo);
    const publishedToken = set.token!;
    sql.prepare("UPDATE users SET disabled=1 WHERE id='owner'").run();
    assert.throws(() => service.publicSet(publishedToken), /notFound/);
    assert.throws(
      () =>
        service.readItemPhoto(set.items[0].id, set.items[0].photo!, "owner"),
      /notFound/,
    );
    sql.prepare("UPDATE users SET disabled=0 WHERE id='owner'").run();
    service.deleteSet(set.id, "owner");
    assert.equal(readdirSync(join(dir, "set-photos")).length, 0);
    assert.throws(() => service.publicSet(publishedToken), /notFound/);
    assert.equal(
      (
        sql
          .prepare("SELECT count(*) n FROM item_set_share_links WHERE set_id=?")
          .get(set.id) as { n: number }
      ).n,
      0,
    );
  } finally {
    sql.close();
    rmSync(dir, { recursive: true, force: true });
  }
});
test("marketplace SKUs and external links validate without unsafe schemes or lookalike hosts", () => {
  assert.equal(
    marketplaceUrl("123", "wb"),
    "https://www.wildberries.ru/catalog/123/detail.aspx",
  );
  assert.equal(
    marketplaceUrl("456", "ozon"),
    "https://www.ozon.ru/product/456/",
  );
  for (const value of [
    "javascript:alert(1)",
    "https://ozon.ru.evil.test/item",
    "https://user:pass@ozon.ru/product/1",
  ])
    assert.equal(
      itemInput.safeParse({ title: "Item", ozon: value }).success,
      false,
    );
  assert.equal(
    itemInput.safeParse({
      title: "Item",
      links: [{ label: "Bad", url: "data:text/html,x" }],
    }).success,
    false,
  );
  assert.equal(itemInput.safeParse({ title: " " }).success, false);
});

test("items require a title and at least one valid destination", () => {
  for (const value of [
    { title: "Thing" },
    { title: "Thing", wb: "   ", ozon: "", amazon: "", ebay: "", links: [] },
    { title: " ", wb: "123" },
  ])
    assert.equal(itemInput.safeParse(value).success, false);
  for (const fields of [
    { wb: "123" },
    { ozon: "456" },
    { amazon: "B0CJJJ7CNY" },
    { ebay: "277438353750" },
    { links: [{ label: "Shop", url: "https://example.com/item" }] },
  ])
    assert.equal(
      itemInput.safeParse({ title: "Thing", ...fields }).success,
      true,
    );
  assert.equal(
    itemInput.safeParse({
      title: "Thing",
      links: [{ label: "Shop", url: "broken" }],
    }).success,
    false,
  );
});
