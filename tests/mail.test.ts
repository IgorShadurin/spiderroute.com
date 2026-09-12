import { test } from "node:test";
import assert from "node:assert/strict";
import { generateKeyPairSync, createSign } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

test("Postal verifies signatures, isolates applications, deduplicates events and suppresses bounces", async () => {
  const dir = mkdtempSync(join(tmpdir(), "spiderroute-mail-"));
  process.env.DATA_DIR = dir;
  const { privateKey, publicKey } = generateKeyPairSync("rsa", {
    modulusLength: 2048,
  });
  process.env.POSTAL_WEBHOOK_PUBLIC_KEY = publicKey
    .export({ type: "spki", format: "pem" })
    .toString();
  const { postalWebhook } = await import("../src/server/mail");
  const { sql } = await import("../src/server/db");
  const event = {
    uuid: "test-event",
    event: "MessageBounced",
    payload: {
      original_message: {
        id: 1,
        message_id: "provider-message",
        tag: "spiderroute",
        to: "TEST@example.test",
      },
    },
  };
  const signed = (data: unknown) => {
    const raw = JSON.stringify(data);
    const signer = createSign("RSA-SHA256");
    signer.update(raw);
    signer.end();
    return { raw, signature: signer.sign(privateKey, "base64") };
  };
  try {
    const valid = signed(event);
    assert.equal(postalWebhook(valid.raw, null), false);
    assert.equal(
      postalWebhook(
        valid.raw.replace("MessageBounced", "MessageSent"),
        valid.signature,
      ),
      false,
    );
    const unrelated = signed({
      ...event,
      payload: {
        original_message: {
          ...event.payload.original_message,
          tag: "other-app",
        },
      },
    });
    assert.equal(postalWebhook(unrelated.raw, unrelated.signature), false);
    const incoming = signed({
      ...event,
      payload: { message: { direction: "incoming", to: "owner@example.test" } },
    });
    assert.equal(postalWebhook(incoming.raw, incoming.signature), true);
    assert.deepEqual(
      sql.prepare("SELECT count(*) AS n FROM delivery_events").get(),
      { n: 0 },
    );
    assert.equal(postalWebhook(valid.raw, valid.signature), true);
    assert.equal(postalWebhook(valid.raw, valid.signature), true);
    assert.deepEqual(
      sql.prepare("SELECT event,message_id FROM delivery_events").all(),
      [{ event: "MessageBounced", message_id: "provider-message" }],
    );
    assert.deepEqual(sql.prepare("SELECT email FROM suppressions").all(), [
      { email: "test@example.test" },
    ]);
  } finally {
    sql.close();
    rmSync(dir, { recursive: true, force: true });
  }
});
