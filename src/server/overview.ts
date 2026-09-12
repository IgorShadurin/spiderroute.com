import type Database from "better-sqlite3";
import type { Geometry } from "../lib/types";
export function overviewGeometry(geometry: Geometry): Geometry {
  const count = geometry.reduce((sum, segment) => sum + segment.length, 0);
  const stride = Math.max(1, Math.ceil(count / 2000));
  return geometry.map((segment) =>
    segment
      .filter((_, i) => i === 0 || i === segment.length - 1 || i % stride === 0)
      .map(({ id, lat, lon }) => ({ id, lat, lon })),
  );
}
export function routeOverview(
  db: Database.Database,
  owner: string,
  ids: string[],
) {
  if (
    !ids.length ||
    ids.length > 20 ||
    ids.some((id) => !id || id.length > 100)
  )
    throw Error("invalidFile");
  return db
    .prepare(
      `SELECT id,title,geometry,stats FROM routes WHERE user_id=? AND id IN (${ids.map(() => "?").join(",")})`,
    )
    .all(owner, ...ids)
    .map((row: any) => ({
      id: row.id,
      title: row.title,
      stats: JSON.parse(row.stats),
      geometry: overviewGeometry(JSON.parse(row.geometry)),
    }));
}
