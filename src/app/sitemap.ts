import { publicSetsForSitemap } from "@/server/item-sets";
export const dynamic = "force-dynamic";
import type { MetadataRoute } from "next";
export default function sitemap(): MetadataRoute.Sitemap {
  const pages = [
    "https://spiderroute.com",
    "https://ru.spiderroute.com",
  ].flatMap((origin) =>
    ["", "/privacy"].map((path) => ({
      url: origin + path,
      alternates: {
        languages: {
          en: "https://spiderroute.com" + path,
          ru: "https://ru.spiderroute.com" + path,
          "x-default": "https://spiderroute.com" + path,
        },
      },
    })),
  );
  return [
    ...pages,
    ...publicSetsForSitemap().map((set) => ({
      url: new URL(
        `/sets/shared/${set.token}`,
        process.env.NEXTAUTH_URL || "https://app.spiderroute.com",
      ).href,
      lastModified: set.updated_at,
    })),
  ];
}
