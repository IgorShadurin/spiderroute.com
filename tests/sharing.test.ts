import { test } from "node:test";
import assert from "node:assert/strict";
import { shareLocale, sharePath, sharedMetadata } from "../src/lib/sharing";

test("shared URLs always carry an explicit supported language", () => {
  for (const locale of ["en", "ru"] as const) {
    assert.equal(
      sharePath("example-token", locale),
      `/s/example-token?lang=${locale}`,
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
      `https://app.spiderroute.com/s/example-token?lang=${locale}`,
    );
    assert.deepEqual(metadata.robots, { index: false, follow: false });
    assert.equal(/[А-Яа-я]/.test(metadata.description!), locale === "ru");
  }
});
