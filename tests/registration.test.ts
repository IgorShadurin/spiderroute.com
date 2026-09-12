import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

test("registration atomically saves the selected language and sends localized welcome content through Postal", async () => {
  const dir = mkdtempSync(join(tmpdir(), "spiderroute-registration-"));
  process.env.DATA_DIR = dir;
  process.env.POSTAL_API_URL = "https://postal.example.test";
  process.env.POSTAL_API_KEY = "test-only";
  const { registerOAuthUser, welcomeEmail } =
    await import("../src/server/registration");
  const { sql } = await import("../src/server/db");
  const { processOutbox } = await import("../src/server/mail");
  const originalFetch = globalThis.fetch;
  const sent: any[] = [];
  globalThis.fetch = async (_url, options) => {
    sent.push(JSON.parse(options!.body as string));
    return new Response(
      JSON.stringify({
        status: "success",
        data: { message_id: "test-" + sent.length },
      }),
    );
  };
  try {
    for (const locale of ["ru", "en"] as const) {
      const id = registerOAuthUser(
        `${locale}@example.test`,
        "Test",
        "google",
        locale,
        locale,
        locale === "ru" ? "light" : "dark",
      );
      assert.deepEqual(
        sql.prepare("SELECT locale,theme FROM users WHERE id=?").get(id),
        { locale, theme: locale === "ru" ? "light" : "dark" },
      );
      assert.deepEqual(
        sql
          .prepare("SELECT subject,body FROM outbox WHERE id=?")
          .get("welcome:" + id),
        welcomeEmail(locale),
      );
      // Later account changes must not rewrite already queued messages.
      sql
        .prepare("UPDATE users SET locale=? WHERE id=?")
        .run(locale === "ru" ? "en" : "ru", id);
      assert.equal(
        (
          sql
            .prepare("SELECT body FROM outbox WHERE id=?")
            .get("welcome:" + id) as any
        ).body,
        welcomeEmail(locale).body,
      );
    }
    assert.throws(() =>
      registerOAuthUser("duplicate@example.test", "Test", "google", "ru", "en"),
    );
    assert.equal(
      (sql.prepare("SELECT count(*) AS n FROM users").get() as any).n,
      2,
    );
    assert.equal(
      (sql.prepare("SELECT count(*) AS n FROM outbox").get() as any).n,
      2,
    );
    assert.deepEqual(welcomeEmail("unsupported"), welcomeEmail("en"));
    await processOutbox();
    assert.equal(sent.length, 2);
    for (const locale of ["ru", "en"]) {
      const mail = sent.find((x) => x.to[0] === `${locale}@example.test`);
      assert.equal(mail.subject, welcomeEmail(locale).subject);
      assert.equal(mail.plain_body, welcomeEmail(locale).body);
      assert.match(mail.plain_body, new RegExp(`lang=${locale}`));
    }
    await processOutbox();
    assert.equal(sent.length, 2, "welcome emails are not sent again");
  } finally {
    globalThis.fetch = originalFetch;
    sql.close();
    rmSync(dir, { recursive: true, force: true });
  }
});
