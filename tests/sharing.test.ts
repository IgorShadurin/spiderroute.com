import { test } from "node:test";
import assert from "node:assert/strict";
import {
  shareLocale,
  sharePath,
  sharedMetadata,
  shareUrl,
  safeShareReturn,
} from "../src/lib/sharing";

test("shared URLs always carry an explicit supported language", () => {
  for (const locale of ["en", "ru"] as const) {
    assert.equal(
      sharePath("example-token", locale),
      `/s/example-token/${locale}`,
    );
    assert.equal(shareLocale(locale), locale);
  }
  for (const value of [undefined, "de", ["ru", "en"]])
    assert.equal(shareLocale(value), "en");
});
test("shared metadata localizes page and social previews without exposing route data", () => {
  for (const locale of ["en", "ru"] as const) {
    const metadata = sharedMetadata("example-token", locale);
    assert.equal(
      metadata.openGraph?.title,
      (metadata.title as { absolute: string }).absolute,
    );
    assert.equal(metadata.twitter?.description, metadata.description);
    assert.equal(metadata.openGraph?.description, metadata.description);
    assert.equal(
      metadata.alternates?.canonical,
      `https://${locale === "ru" ? "ru." : ""}spiderroute.com/example-token`,
    );
    assert.deepEqual(metadata.robots, { index: false, follow: false });
    assert.equal(/[А-Яа-я]/.test(metadata.description!), locale === "ru");
  }
});

test("short links preserve explicit language and only safe internal share return URLs", () => {
  const code = "AbCdEfGh01234567";
  assert.equal(shareUrl(code, "ru"), `https://ru.spiderroute.com/${code}`);
  assert.equal(safeShareReturn(`/s/${code}?lang=en`), `/s/${code}?lang=en`);
  assert.equal(
    safeShareReturn(`/s/${"x".repeat(32)}?lang=ru`),
    `/s/${"x".repeat(32)}?lang=ru`,
  );
  assert.equal(safeShareReturn(`/s/${code}/ru`), `/s/${code}/ru`);
  assert.equal(safeShareReturn(`/s/${code}/en`), `/s/${code}/en`);
  for (const value of [
    `/s/${code}/de`,
    `/s/${code}/ru?next=https://evil.test`,
    null,
    "//evil.test",
    "https://evil.test",
    "/s/123",
    "/s/" + code + "?next=https://evil.test",
  ])
    assert.equal(safeShareReturn(value), undefined);
});

test("public share links round-trip their language through the hostname", () => {
  for (const locale of ["en", "ru"] as const) {
    const url = new URL(shareUrl("FCCPWJRAYvkVVPKp", locale));
    assert.equal(url.pathname, "/FCCPWJRAYvkVVPKp");
    assert.equal(url.search, "");
    assert.equal(shareLocale(undefined, url.host), locale);
  }
  assert.equal(shareLocale(undefined, "ru.spiderroute.com:3218"), "ru");
  assert.equal(shareLocale("en", "ru.spiderroute.com"), "en");
  assert.equal(shareLocale("ru", "spiderroute.com"), "ru");
  assert.equal(shareLocale("de", "ru.spiderroute.com"), "ru");
  assert.equal(shareLocale(undefined, "ru.spiderroute.com.evil.test"), "en");
});

test("shared page and social titles use the bounded public route name", () => {
  const metadata = sharedMetadata(
    "abcdefghijklmnop",
    "ru",
    "  Минск\n Молодечно  ",
  );
  const expected = "Минск Молодечно · Веломаршрут";
  assert.deepEqual(metadata.title, { absolute: expected });
  assert.equal(metadata.openGraph?.title, expected);
  assert.equal(metadata.twitter?.title, expected);
  for (const locale of ["ru", "en"] as const) {
    const suffix = locale === "ru" ? " · Веломаршрут" : " · Cycling route";
    for (const name of ["🚲".repeat(100), "Длинное название ".repeat(20)]) {
      const long = sharedMetadata("abcdefghijklmnop", locale, name);
      const title = (long.title as { absolute: string }).absolute;
      assert.ok(Array.from(title).length <= 70);
      assert.ok(title.endsWith("…" + suffix));
      assert.ok(Array.from(long.description!).length <= 160);
      assert.ok(!title.includes("SpiderRoute"));
    }
    const short = sharedMetadata("abcdefghijklmnop", locale, "Morning ride");
    assert.deepEqual(short.title, { absolute: "Morning ride" + suffix });
  }
});

test("shared SEO fields agree across locales and refer to the public name", () => {
  for (const locale of ["ru", "en"] as const) {
    const metadata = sharedMetadata("abcdefghijklmnop", locale, "River ride");
    assert.ok(metadata.description?.includes("River ride"));
    assert.equal(metadata.openGraph?.url, shareUrl("abcdefghijklmnop", locale));
    assert.deepEqual(metadata.alternates?.languages, {
      en: shareUrl("abcdefghijklmnop", "en"),
      ru: shareUrl("abcdefghijklmnop", "ru"),
      "x-default": shareUrl("abcdefghijklmnop", "en"),
    });
    assert.deepEqual(metadata.openGraph?.images, metadata.twitter?.images);
    assert.equal((metadata.twitter as { card: string }).card, "summary");
  }
});
