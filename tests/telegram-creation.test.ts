import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
test("creation alerts describe committed content, respect all switches and tolerate failure", async () => {
  const dir = mkdtempSync(join(tmpdir(), "creation-alerts-"));
  process.env.DATA_DIR = dir;
  process.env.TELEGRAM_BOT_TOKEN = "test-token";
  process.env.TELEGRAM_CHAT_ID = "test-chat";
  const { sql } = await import("../src/server/db");
  const { saveSet } = await import("../src/server/item-sets");
  const { createRoute } = await import("../src/server/routes");
  const { notifyCreation } =
    await import("../src/server/creation-notifications");
  const originalFetch = globalThis.fetch,
    originalError = console.error;
  const messages: string[] = [];
  globalThis.fetch = async (_url, options) => {
    const body = JSON.parse(options!.body as string);
    assert.equal(body.parse_mode, undefined);
    messages.push(body.text);
    return Response.json({ ok: true });
  };
  try {
    sql
      .prepare("INSERT INTO users(id,email,name,created_at) VALUES(?,?,?,?)")
      .run("owner", "owner@example.test", "Owner", "2026-09-20");
    const set = saveSet("owner", { title: "Kit\nwith links" });
    const route = createRoute("owner", "Ride", [
      [
        { id: "a", lat: 50, lon: 30 },
        { id: "b", lat: 50.1, lon: 30.1 },
      ],
    ]);
    await notifyCreation("set", set.id, "owner");
    await notifyCreation("route", route.id, "owner");
    assert.equal(messages.length, 2);
    assert.match(messages[0], /New Set \(local\)/);
    assert.match(messages[0], /Total sets: 1/);
    assert.match(messages[1], /Total routes: 1/);
    assert.match(messages[1], /owner@example.test/);
    assert.doesNotMatch(messages[1], /geometry|lat|lon/);
    process.env.TELEGRAM_ROUTE_CREATION_NOTIFICATIONS_ENABLED = "false";
    await notifyCreation("route", route.id, "owner");
    assert.equal(messages.length, 2);
    await notifyCreation("set", set.id, "owner");
    assert.equal(messages.length, 3);
    process.env.TELEGRAM_SET_CREATION_NOTIFICATIONS_ENABLED = "off";
    await notifyCreation("set", set.id, "owner");
    assert.equal(messages.length, 3);
    delete process.env.TELEGRAM_SET_CREATION_NOTIFICATIONS_ENABLED;
    process.env.TELEGRAM_NOTIFICATIONS_ENABLED = "false";
    await notifyCreation("set", set.id, "owner");
    assert.equal(messages.length, 3);
    delete process.env.TELEGRAM_NOTIFICATIONS_ENABLED;
    await notifyCreation("set", "missing", "owner");
    assert.equal(messages.length, 3);
    globalThis.fetch = async () => {
      throw Error("test-token");
    };
    const errors: unknown[] = [];
    console.error = (...args) => errors.push(args);
    await notifyCreation("set", set.id, "owner");
    assert.equal(errors.length, 1);
    assert.doesNotMatch(JSON.stringify(errors), /test-token/);
    assert.ok(sql.prepare("SELECT id FROM item_sets WHERE id=?").get(set.id));
  } finally {
    globalThis.fetch = originalFetch;
    console.error = originalError;
    sql.close();
    rmSync(dir, { recursive: true, force: true });
  }
});
