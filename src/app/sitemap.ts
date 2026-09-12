import type { MetadataRoute } from "next";
export default function sitemap(): MetadataRoute.Sitemap {
  return ["https://spiderroute.com", "https://ru.spiderroute.com"].flatMap(
    (origin) =>
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
}
