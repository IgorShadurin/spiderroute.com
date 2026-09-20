import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

test("new registrations notify Telegram with committed non-demo totals and tolerate delivery failures", async () => {
  const dir = mkdtempSync(join(tmpdir(), "spiderroute-telegram-"));
  process.env.DATA_DIR = dir;
  process.env.TELEGRAM_BOT_TOKEN = "test-token";
  process.env.TELEGRAM_CHAT_ID = "test-chat";
  process.env.TELEGRAM_REGISTRATION_NOTIFICATIONS_ENABLED = "true";
  const { registerOAuthUser } = await import("../src/server/registration");
  const { sql } = await import("../src/server/db");
  const originalFetch = globalThis.fetch;
  const originalError = console.error;
  const messages: any[] = [];
  const errors: unknown[][] = [];
  let delivery: "ok" | "http-error" | "api-error" | "network-error" = "ok";
  console.error = (...args) => {
    errors.push(args);
  };
  globalThis.fetch = async (url, options) => {
    assert.equal(url, "https://api.telegram.org/bottest-token/sendMessage");
    assert.equal(options?.method, "POST");
    assert.ok(options?.signal);
    const body = JSON.parse(options!.body as string);
    messages.push(body);
    assert.equal(body.chat_id, "test-chat");
    assert.equal(
      body.parse_mode,
      undefined,
      "user text cannot inject Telegram formatting",
    );
    const id = body.text.match(/User ID: (.+)/)[1];
    assert.ok(
      sql.prepare("SELECT id FROM users WHERE id=?").get(id),
      "send only after commit",
    );
    if (delivery === "network-error")
      throw Error("request URL with test-token");
    return new Response(JSON.stringify({ ok: delivery === "ok" }), {
      status: delivery === "http-error" ? 503 : 200,
    });
  };
  try {
    sql
      .prepare(
        "INSERT INTO users(id,email,name,is_demo,created_at) VALUES(?,?,?,?,?)",
      )
      .run("demo", "demo@example.test", "Demo", 1, new Date().toISOString());
    const first = await registerOAuthUser(
      "FIRST@example.test",
      "First\n👥 Fake total",
      "google",
      "first",
      "en",
    );
    assert.match(messages[0].text, /\[spiderroute.com\]/);
    assert.match(messages[0].text, /Email: first@example.test/);
    assert.match(messages[0].text, /Name: First 👥 Fake total/);
    assert.match(messages[0].text, /Total registered users: 1$/);
    sql.prepare("UPDATE users SET disabled=1 WHERE id=?").run(first);
    await registerOAuthUser(
      "second@example.test",
      "Second",
      "apple",
      "second",
      "ru",
    );
    assert.match(messages[1].text, /Provider: apple/);
    assert.match(messages[1].text, /Total registered users: 2$/);
    await assert.rejects(() =>
      registerOAuthUser(
        "failed@example.test",
        "Duplicate identity",
        "google",
        "first",
        "en",
      ),
    );
    assert.equal(messages.length, 2, "rolled-back registration sends no alert");
    for (const failure of [
      "http-error",
      "api-error",
      "network-error",
    ] as const) {
      delivery = failure;
      const id = await registerOAuthUser(
        `${failure}@example.test`,
        "Failure",
        "google",
        failure,
        "en",
      );
      assert.ok(sql.prepare("SELECT id FROM users WHERE id=?").get(id));
      assert.ok(
        sql.prepare("SELECT id FROM outbox WHERE id=?").get("welcome:" + id),
      );
    }
    assert.equal(errors.length, 3);
    assert.doesNotMatch(JSON.stringify(errors), /test-token|example.test/);
    process.env.TELEGRAM_REGISTRATION_NOTIFICATIONS_ENABLED = "false";
    await registerOAuthUser("off@example.test", "Off", "google", "off", "en");
    assert.equal(messages.length, 5);
    process.env.TELEGRAM_REGISTRATION_NOTIFICATIONS_ENABLED = "true";
    delete process.env.TELEGRAM_BOT_TOKEN;
    await registerOAuthUser(
      "unconfigured@example.test",
      "Unconfigured",
      "google",
      "unconfigured",
      "en",
    );
    assert.equal(messages.length, 5);
  } finally {
    globalThis.fetch = originalFetch;
    console.error = originalError;
    sql.close();
    rmSync(dir, { recursive: true, force: true });
  }
});
