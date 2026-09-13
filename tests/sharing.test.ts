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
      `https://spiderroute.com/example-token/${locale}`,
    );
    assert.deepEqual(metadata.robots, { index: false, follow: false });
    assert.equal(/[А-Яа-я]/.test(metadata.description!), locale === "ru");
  }
});

test("short links preserve explicit language and only safe internal share return URLs", () => {
  const code = "AbCdEfGh01234567";
  assert.equal(shareUrl(code, "ru"), `https://spiderroute.com/${code}/ru`);
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
