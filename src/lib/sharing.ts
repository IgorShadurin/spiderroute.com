import type { Metadata } from "next";
import type { Locale } from "./types";

export function shareLocale(
  value: string | string[] | undefined,
  host?: string,
): Locale {
  if (value === "ru" || value === "en") return value;
  return host?.toLowerCase().split(":")[0] === "ru.spiderroute.com"
    ? "ru"
    : "en";
}

export function sharePath(token: string, locale: Locale): string {
  return `/s/${encodeURIComponent(token)}/${locale}`;
}

export function shareUrl(token: string, locale: Locale): string {
  const host = locale === "ru" ? "ru.spiderroute.com" : "spiderroute.com";
  return `https://${host}/${encodeURIComponent(token)}`;
}
export function safeShareReturn(value: string | null): string | undefined {
  if (!value) return;
  return /^\/s\/(?:[A-Za-z0-9_-]{16}|[A-Za-z0-9_-]{32})(?:\/(?:en|ru)|\?lang=(?:en|ru))?$/.test(
    value,
  )
    ? value
    : undefined;
}

export function sharedMetadata(token: string, locale: Locale): Metadata {
  const ru = locale === "ru";
  const title = ru
    ? "Маршрут на карте · SpiderRoute"
    : "Shared route map · SpiderRoute";
  const description = ru
    ? "Посмотрите маршрут для велосипеда или самоката на карте, изучите заметки и сохраните копию в своей коллекции SpiderRoute."
    : "View a bike or scooter route on the map, read ride notes and save a copy to your SpiderRoute collection.";
  const url = shareUrl(token, locale);
  return {
    title: { absolute: title },
    description,
    robots: { index: false, follow: false },
    referrer: "strict-origin-when-cross-origin",
    alternates: {
      canonical: url,
      languages: {
        en: shareUrl(token, "en"),
        ru: shareUrl(token, "ru"),
      },
    },
    openGraph: {
      type: "website",
      title,
      description,
      url,
      siteName: "SpiderRoute",
      locale: ru ? "ru_RU" : "en_US",
    },
    twitter: { card: "summary", title, description },
  };
}
