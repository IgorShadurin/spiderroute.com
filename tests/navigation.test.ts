import test from "node:test";
import assert from "node:assert/strict";
import { privateRoutePath, routeIdFromUrl } from "../src/lib/navigation";
import { sharePath, safeShareReturn } from "../src/lib/sharing";
import { proxy } from "../src/proxy";
import { NextRequest } from "next/server";

test("private route URLs and legacy navigation resolve without affecting public routes", () => {
  const id = "5753521f-d07d-4ba0-b01d-19ddf98f5726";
  assert.equal(privateRoutePath(id), `/r/${id}`);
  for (const path of [`/r/${id}`, `/workspace?lang=ru&route=${id}`]) {
    assert.equal(
      routeIdFromUrl(new URL(path, "https://app.spiderroute.com")),
      id,
    );
  }
  assert.equal(
    routeIdFromUrl(new URL("https://app.spiderroute.com/workspace")),
    null,
  );
  assert.equal(
    routeIdFromUrl(new URL("https://app.spiderroute.com/s/abc?route=bad")),
    null,
  );
  const shared = sharePath("abcdefghijklmnop", "ru");
  assert.equal(shared, "/s/abcdefghijklmnop/ru");
  assert.equal(safeShareReturn(shared), shared);
});

test("old private URLs redirect to clean paths while shared language stays intact", () => {
  for (const path of ["/workspace?route=abc&lang=ru", "/r/abc?lang=en"]) {
    const result = proxy(new NextRequest(`https://app.spiderroute.com${path}`));
    assert.equal(result.status, 307);
    assert.equal(
      result.headers.get("location"),
      "https://app.spiderroute.com/r/abc",
    );
  }
  const result = proxy(
    new NextRequest("https://app.spiderroute.com/s/abcdefghijklmnop?lang=ru"),
  );
  assert.equal(result.headers.get("location"), null);
  assert.equal(
    result.headers.get("x-middleware-request-x-spiderroute-locale"),
    "ru",
  );
});

test("app workspace redirects home while keeping authentication and old route links intact", () => {
  for (const suffix of [
    "",
    "?returnTo=%2Fs%2Fabcdefghijklmnop%2Fru",
    "?error=accountLink",
    "?lang=ru",
  ]) {
    const result = proxy(
      new NextRequest(`https://app.spiderroute.com/workspace${suffix}`),
    );
    assert.equal(
      result.headers.get("location"),
      `https://app.spiderroute.com/${suffix}`,
    );
  }
  for (const address of [
    "https://app.spiderroute.com/",
    "https://spiderroute.com/",
    "http://localhost:3210/workspace",
  ]) {
    assert.equal(proxy(new NextRequest(address)).headers.get("location"), null);
  }
  const result = proxy(
    new NextRequest("https://app.spiderroute.com/s/abcdefghijklmnop/ru"),
  );
  assert.equal(
    result.headers.get("x-middleware-request-x-spiderroute-locale"),
    "ru",
  );
});
