export function routePageTitle(name: string) {
  const clean = name
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const chars = Array.from(clean || "Route");
  return `${chars.length > 60 ? chars.slice(0, 59).join("").trimEnd() + "…" : chars.join("")} · SpiderRoute`;
}
export function youtubeId(value: string): string | null {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.username || url.password || url.port)
      return null;
    const host = url.hostname.toLowerCase();
    const parts = url.pathname.split("/").filter(Boolean);
    const id =
      host === "youtu.be"
        ? parts[0]
        : ["youtube.com", "www.youtube.com", "m.youtube.com"].includes(host)
          ? url.pathname === "/watch"
            ? url.searchParams.get("v")
            : ["shorts", "embed", "live"].includes(parts[0])
              ? parts[1]
              : null
          : null;
    return id && /^[a-zA-Z0-9_-]{11}$/.test(id) ? id : null;
  } catch {
    return null;
  }
}
export function normalizeYoutube(value: unknown): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string" || value.length > 2048)
    throw Error("invalidVideo");
  if (!value.trim()) return null;
  const id = youtubeId(value.trim());
  if (!id) throw Error("invalidVideo");
  return `https://www.youtube.com/watch?v=${id}`;
}
