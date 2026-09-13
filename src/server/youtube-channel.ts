import type Database from "better-sqlite3";
import { channelId } from "../lib/youtube-channel";
const cache = new Map<string, { id: string | null; expires: number }>();
async function youtubeText(url: string) {
  const response = await fetch(url, {
    redirect: "error",
    signal: AbortSignal.timeout(7000),
    headers: { "User-Agent": "SpiderRoute/1.0", "Accept-Language": "en" },
  });
  if (!response.ok || !response.body) throw Error("unavailable");
  const reader = response.body.getReader();
  let size = 0,
    text = "";
  const decoder = new TextDecoder();
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > 3_000_000) throw Error("tooLarge");
      text += decoder.decode(value, { stream: true });
    }
    return text + decoder.decode();
  } finally {
    await reader.cancel();
  }
}
export function authorPath(value: unknown): string | null {
  if (typeof value !== "string") return null;
  try {
    const u = new URL(value);
    return u.protocol === "https:" &&
      u.hostname === "www.youtube.com" &&
      !u.port &&
      !u.username &&
      !u.password &&
      /^\/(?:@[\p{L}\p{N}_.-]+|channel\/UC[A-Za-z0-9_-]{22}|user\/[A-Za-z0-9_-]+)$/u.test(
        decodeURI(u.pathname),
      )
      ? u.pathname
      : null;
  } catch {
    return null;
  }
}
export async function detectChannel(
  video: string,
  db?: Database.Database,
): Promise<string | null> {
  if (!/^[A-Za-z0-9_-]{11}$/.test(video)) throw Error("invalidVideo");
  const saved = db
    ?.prepare(
      "SELECT channel_id,verified_at FROM youtube_channels WHERE video_id=?",
    )
    .get(video) as { channel_id: string; verified_at: number } | undefined;
  if (saved && saved.verified_at > Date.now() - 30 * 86400000)
    return channelId(saved.channel_id);
  const hit = cache.get(video);
  if (hit && hit.expires > Date.now())
    return hit.id ?? saved?.channel_id ?? null;
  let id: string | null = null;
  try {
    const data = JSON.parse(
      await youtubeText(
        "https://www.youtube.com/oembed?format=json&url=" +
          encodeURIComponent("https://www.youtube.com/watch?v=" + video),
      ),
    );
    const path = authorPath(data.author_url);
    if (path?.startsWith("/channel/")) id = channelId(path.slice(9));
    else if (path) {
      const html = await youtubeText("https://www.youtube.com" + path);
      const match = /"externalId"\s*:\s*"(UC[A-Za-z0-9_-]{22})"/.exec(html);
      if (match) id = channelId(match[1]);
    }
  } catch {}
  if (id && db)
    db.prepare(
      "INSERT INTO youtube_channels VALUES(?,?,?) ON CONFLICT(video_id) DO UPDATE SET channel_id=excluded.channel_id,verified_at=excluded.verified_at",
    ).run(video, id, Date.now());
  id = id ?? saved?.channel_id ?? null;
  if (cache.size >= 500) cache.delete(cache.keys().next().value!);
  cache.set(video, { id, expires: Date.now() + (id ? 86400000 : 60000) });
  return id;
}
