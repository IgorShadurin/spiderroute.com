import type { Metadata } from "next";
import type { Locale } from "./types";

export function shareLocale(value: string | string[] | undefined): Locale {
  return value === "ru" ? "ru" : "en";
}

export function sharePath(token: string, locale: Locale): string {
  return `/s/${encodeURIComponent(token)}?lang=${locale}`;
}

export function sharedMetadata(token: string, locale: Locale): Metadata {
  const ru = locale === "ru";
  const title = ru
    ? "Маршрут на карте · SpiderRoute"
    : "Shared route map · SpiderRoute";
  const description = ru
    ? "Посмотрите маршрут для велосипеда или самоката на карте, изучите заметки и сохраните копию в своей коллекции SpiderRoute."
    : "View a bike or scooter route on the map, read ride notes and save a copy to your SpiderRoute collection.";
  const url = `https://app.spiderroute.com${sharePath(token, locale)}`;
  return {
    title: { absolute: title },
    description,
    robots: { index: false, follow: false },
    referrer: "strict-origin-when-cross-origin",
    alternates: {
      canonical: url,
      languages: {
        en: `https://app.spiderroute.com${sharePath(token, "en")}`,
        ru: `https://app.spiderroute.com${sharePath(token, "ru")}`,
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
