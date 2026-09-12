import { writeFileSync, mkdirSync } from "node:fs";
import { layers, namedFlavor } from "@protomaps/basemaps";
const origin = process.env.TILES_ORIGIN || "https://tiles.spiderroute.com";
if (new URL(origin).protocol !== "https:") throw Error("HTTPS required");
mkdirSync("ops/tiles/www", { recursive: true });
for (const lang of ["en", "ru"])
  writeFileSync(
    `ops/tiles/www/style-${lang}.json`,
    JSON.stringify({
      version: 8,
      sources: {
        protomaps: {
          type: "vector",
          tiles: [origin + "/tiles/world/{z}/{x}/{y}.mvt"],
          maxzoom: 15,
          attribution: "© OpenStreetMap contributors · Protomaps",
        },
      },
      layers: layers("protomaps", namedFlavor("light"), { lang }),
      glyphs: origin + "/assets/fonts/{fontstack}/{range}.pbf",
      sprite: origin + "/assets/sprites/v4/light",
    }),
  );
writeFileSync(
  "ops/tiles/www/style.json",
  await (
    await import("node:fs/promises")
  ).readFile("ops/tiles/www/style-en.json"),
);
console.log("Generated EN/RU self-hosted styles.");
