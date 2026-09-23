import { test } from "node:test";
import assert from "node:assert/strict";
import { channelId, subscription } from "../src/lib/youtube-channel";
import {
  authorPath,
  detectChannel,
  videoChannel,
} from "../src/server/youtube-channel";
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
    assert.equal(urls.length, 3);
    assert.equal(urls[2], "https://www.youtube.com/@creator");
    assert.equal(await detectChannel("testVideo01"), id);
    assert.equal(urls.length, 3);
    global.fetch = async () => new Response("unavailable", { status: 404 });
    assert.equal(await detectChannel("testVideo02"), null);
    await assert.rejects(() => detectChannel("bad"));
  } finally {
    global.fetch = original;
  }
});

test("video metadata wins over unrelated channels and fills the current video's channel", async () => {
  const video = "testVideo04";
  const html = `"channelId":"UCaaaaaaaaaaaaaaaaaaaaaa"\n"videoDetails":{"videoId":"${video}","title":"Ride","channelId":"${id}"}`;
  assert.equal(videoChannel(html, video), id);
  assert.equal(videoChannel(html, "otherVideo1"), null);
  const consentPage =
    `"videoId":"${video}"` +
    "x".repeat(1200) +
    `"videoOwnerRenderer":{"title":{"runs":[{"navigationEndpoint":{"browseEndpoint":{"browseId":"${id}"}}}]}}`;
  assert.equal(videoChannel(consentPage, video), id);
  assert.equal(videoChannel(consentPage, "otherVideo1"), null);
  const original = global.fetch;
  const urls: string[] = [];
  global.fetch = async (input) => {
    urls.push(String(input));
    return new Response(html);
  };
  try {
    assert.equal(await detectChannel(video), id);
    assert.deepEqual(urls, ["https://www.youtube.com/watch?v=" + video]);
  } finally {
    global.fetch = original;
  }
});

test("verified channel mappings survive process-cache misses and upstream failures", async () => {
  const { default: Database } = await import("better-sqlite3");
  const db = new Database(":memory:");
  const original = global.fetch;
  db.exec(
    "CREATE TABLE youtube_channels(video_id TEXT PRIMARY KEY,channel_id TEXT,verified_at INTEGER)",
  );
  try {
    db.prepare("INSERT INTO youtube_channels VALUES(?,?,?)").run(
      "testVideo03",
      id,
      Date.now(),
    );
    global.fetch = async () => {
      throw Error("upstream unavailable");
    };
    assert.equal(await detectChannel("testVideo03", db), id);
    db.prepare("UPDATE youtube_channels SET verified_at=0").run();
    assert.equal(await detectChannel("testVideo03", db), id);
  } finally {
    global.fetch = original;
    db.close();
  }
});
