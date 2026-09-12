import { mkdir, copyFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
const dist = dirname(fileURLToPath(import.meta.resolve("maplibre-gl")));
const target = "public/maplibre/6.9.0";
await mkdir(target, { recursive: true });
// The v6 worker imports its shared sibling. Serve both untransformed so the
// browser can resolve that import independently of Turbopack's module graph.
for (const name of ["maplibre-gl-worker.mjs", "maplibre-gl-shared.mjs"])
  await copyFile(join(dist, name), join(target, name));
