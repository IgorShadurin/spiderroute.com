import type { Locale } from "./types";

export function routePageTitle(name: string, locale?: Locale) {
  const clean = name
    .normalize("NFC")
    .replace(/[\u0000-\u001f\u007f-\u009f]/g, " ")
    .replace(/[\u200b\u200e\u200f\u202a-\u202e\u2060\u2066-\u2069\ufeff]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  const suffix = locale
    ? ` · ${locale === "ru" ? "Веломаршрут" : "Cycling route"}`
    : " · SpiderRoute";
  const nameLimit = (locale ? 70 : 74) - Array.from(suffix).length;
  const chars = Array.from(clean || (locale === "ru" ? "Маршрут" : "Route"));
  const title =
    chars.length > nameLimit
      ? chars
          .slice(0, nameLimit - 1)
          .join("")
          .trimEnd() + "…"
      : chars.join("");
  return title + suffix;
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
