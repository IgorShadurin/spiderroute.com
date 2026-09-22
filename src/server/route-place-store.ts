import { sql, dataDir } from "./db";
import { join } from "node:path";
import { unlinkSync } from "node:fs";
import { distance } from "@/lib/geo";
import type { Point, RoutePlace } from "@/lib/types";
export const placePhotoDir = join(dataDir, "place-photos");
export function routePlaces(id: string): RoutePlace[] {
  return sql
    .prepare(
      "SELECT id,title,description,lat,lon,photo,icon FROM route_places WHERE route_id=? ORDER BY created_at,id",
    )
    .all(id) as RoutePlace[];
}
export function visiblePlaces(
  places: RoutePlace[],
  start: Point,
  end: Point,
  startRadius: number,
  endRadius: number,
) {
  return places.filter(
    (p) =>
      !(
        (startRadius > 0 && distance(start, p) <= startRadius + 1) ||
        (endRadius > 0 && distance(end, p) <= endRadius + 1)
      ),
  );
}
export function removePlacePhoto(photo?: string | null) {
  if (!photo || !/^[a-f0-9-]+\.webp$/.test(photo)) return;
  try {
    unlinkSync(join(placePhotoDir, photo));
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code !== "ENOENT") throw e;
  }
}
