import type { MetadataRoute } from "next";
export default function sitemap(): MetadataRoute.Sitemap {
  return ["", "/privacy"].map((path) => ({
    url: "https://spiderroute.com" + path,
    alternates: {
      languages: {
        en: "https://spiderroute.com" + path,
        ru: "https://ru.spiderroute.com" + path,
      },
    },
  }));
}
