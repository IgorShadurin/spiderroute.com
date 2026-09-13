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
export async function detectChannel(video: string): Promise<string | null> {
  if (!/^[A-Za-z0-9_-]{11}$/.test(video)) throw Error("invalidVideo");
  const hit = cache.get(video);
  if (hit && hit.expires > Date.now()) return hit.id;
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
  if (cache.size >= 500) cache.delete(cache.keys().next().value!);
  cache.set(video, { id, expires: Date.now() + (id ? 86400000 : 60000) });
  return id;
}
