import { test } from "node:test";
import assert from "node:assert/strict";
import { channelId, subscription } from "../src/lib/youtube-channel";
import { authorPath, detectChannel } from "../src/server/youtube-channel";
const id = "UC_x5XG1OV2P6uZZ5FSM9Ttw";
test("channel and widget settings validate without allowing arbitrary URLs", () => {
  assert.equal(channelId(id), id);
  assert.equal(channelId("https://www.youtube.com/channel/" + id), id);
  assert.deepEqual(subscription(undefined), { enabled: true, channelId: null });
  assert.deepEqual(subscription({ enabled: false, channelId: id }), {
    enabled: false,
    channelId: id,
  });
  for (const value of [
    "@channel",
    "javascript:alert(1)",
    "https://evil.test/channel/" + id,
    id + "/evil",
    123,
  ])
    assert.throws(() => channelId(value));
  for (const value of [
    { enabled: "true" },
    [],
    { enabled: true, channelId: "bad" },
  ])
    assert.throws(() => subscription(value));
  assert.equal(authorPath("https://www.youtube.com/@channel"), "/@channel");
  for (const value of [
    "http://www.youtube.com/@x",
    "https://evil.test/@x",
    "https://www.youtube.com:8888/@x",
    "https://user@www.youtube.com/@x",
    "https://www.youtube.com/redirect?url=evil",
  ])
    assert.equal(authorPath(value), null);
});
test("automatic channel resolution uses only YouTube author metadata and handles unavailable videos", async () => {
  const original = global.fetch;
  const urls: string[] = [];
  global.fetch = async (input) => {
    urls.push(String(input));
    return new Response(
      String(input).includes("oembed")
        ? JSON.stringify({ author_url: "https://www.youtube.com/@creator" })
        : JSON.stringify({ externalId: id }),
    );
  };
  try {
    assert.equal(await detectChannel("testVideo01"), id);
    assert.equal(urls.length, 2);
    assert.equal(urls[1], "https://www.youtube.com/@creator");
    assert.equal(await detectChannel("testVideo01"), id);
    assert.equal(urls.length, 2);
    global.fetch = async () => new Response("unavailable", { status: 404 });
    assert.equal(await detectChannel("testVideo02"), null);
    await assert.rejects(() => detectChannel("bad"));
  } finally {
    global.fetch = original;
  }
});
