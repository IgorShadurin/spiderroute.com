import test from "node:test";
import assert from "node:assert/strict";
import Database from "better-sqlite3";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  marketplaceOrder,
  marketplaceUrl,
  itemInput,
} from "../src/lib/item-sets";
test("marketplace identifiers, regional links and language order", () => {
  assert.deepEqual(marketplaceOrder("ru"), ["wb", "ozon", "amazon", "ebay"]);
  assert.deepEqual(marketplaceOrder("en"), ["amazon", "ebay", "wb", "ozon"]);
  assert.equal(
    marketplaceUrl("b0cjjj7cny", "amazon"),
    "https://www.amazon.com/dp/B0CJJJ7CNY",
  );
  assert.equal(
    marketplaceUrl("277438353750", "ebay"),
    "https://www.ebay.com/itm/277438353750",
  );
  for (const [market, url] of [
    ["amazon", "https://www.amazon.co.uk/dp/B0CJJJ7CNY"],
    ["ebay", "https://www.ebay.de/itm/277438353750"],
  ] as const)
    assert.equal(marketplaceUrl(url, market), url);
  for (const market of ["amazon", "ebay"] as const)
    for (const value of [
      "javascript:alert(1)",
      `https://${market}.com.evil.test/item`,
      `https://user:pass@${market}.com/item`,
      "https://example.com/item",
    ])
      assert.equal(
        itemInput.safeParse({ title: "Test", [market]: value }).success,
        false,
      );
  assert.equal(itemInput.parse({ title: "Old client", wb: "123" }).amazon, "");
});
test("legacy item migration preserves data and new marketplaces persist through edits and publication", async () => {
  const dir = mkdtempSync(join(tmpdir(), "marketplace-migration-"));
  process.env.DATA_DIR = dir;
  const legacy = new Database(join(dir, "spiderroute.sqlite"));
  legacy.exec(
    "CREATE TABLE set_items(id TEXT PRIMARY KEY,set_id TEXT NOT NULL,title TEXT NOT NULL,description TEXT DEFAULT '',wb TEXT DEFAULT '',ozon TEXT DEFAULT '',links TEXT DEFAULT '[]',photo TEXT,created_at TEXT NOT NULL)",
  );
  legacy
    .prepare(
      "INSERT INTO set_items(id,set_id,title,wb,ozon,created_at) VALUES(?,?,?,?,?,?)",
    )
    .run("legacy", "legacy-set", "Old item", "123", "456", "2026-09-20");
  legacy.close();
  const service = await import("../src/server/item-sets");
  const { sql } = await import("../src/server/db");
  try {
    assert.deepEqual(
      sql
        .prepare("SELECT wb,ozon,amazon,ebay FROM set_items WHERE id='legacy'")
        .get(),
      { wb: "123", ozon: "456", amazon: "", ebay: "" },
    );
    sql
      .prepare("INSERT INTO users(id,email,name,created_at) VALUES(?,?,?,?)")
      .run("owner", "owner@example.test", "Owner", "2026-09-20");
    sql.prepare("UPDATE users SET locale='ru' WHERE id='owner'").run();
    const set = service.saveSet("owner", { title: "Kit" });
    assert.equal(
      set.locale,
      "ru",
      "new sets inherit account language when omitted",
    );
    const translated = service.saveSet(
      "owner",
      { title: "Kit", locale: "en" },
      set.id,
    );
    assert.equal(
      service.saveSet("owner", { title: "Updated kit" }, translated.id).locale,
      "en",
      "edits preserve the saved public language",
    );
    const input = {
      title: "Camera",
      wb: "123",
      ozon: "456",
      amazon: "B0CJJJ7CNY",
      ebay: "277438353750",
    };
    const saved = service.saveItem(set.id, "owner", input);
    const id = saved.savedItemId;
    assert.equal(
      service.ownedSet(set.id, "owner").items[0].amazon,
      input.amazon,
    );
    const updated = service.saveItem(
      set.id,
      "owner",
      { ...input, amazon: "https://www.amazon.de/dp/B0CJJJ7CNY" },
      id,
    );
    assert.equal(updated.items[0].ebay, input.ebay);
    const shared = service.setVisibility(set.id, "owner", true);
    assert.equal(
      service.publicSet(shared.token!).items[0].amazon,
      updated.items[0].amazon,
    );
    assert.equal(service.publicSet(shared.token!).items[0].wb, "123");
  } finally {
    sql.close();
    rmSync(dir, { recursive: true, force: true });
  }
});
