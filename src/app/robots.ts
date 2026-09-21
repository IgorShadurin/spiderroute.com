import type { MetadataRoute } from "next";
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/workspace", "/s/", "/api/", "/sets$"],
    },
    sitemap: "https://spiderroute.com/sitemap.xml",
  };
}
