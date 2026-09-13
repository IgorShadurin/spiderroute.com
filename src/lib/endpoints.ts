import type { Geometry } from "./types";
export type RouteEndpoints = { startId: string; endId: string };
/** Complete timestamp data takes precedence; otherwise preserve track order. */
export function routeEndpoints(
  geometry: Geometry,
  preferred?: Partial<RouteEndpoints> | null,
): RouteEndpoints | undefined {
  const points = geometry.flat();
  if (!points.length) return undefined;
  let start = points[0],
    end = points[points.length - 1];
  if (points.every((p) => p.time && Number.isFinite(Date.parse(p.time)))) {
    for (const p of points) {
      if (Date.parse(p.time!) < Date.parse(start.time!)) start = p;
      if (Date.parse(p.time!) >= Date.parse(end.time!)) end = p;
    }
  }
  return {
    startId: points.find((p) => p.id === preferred?.startId)?.id ?? start.id,
    endId: points.find((p) => p.id === preferred?.endId)?.id ?? end.id,
  };
}
export function validateEndpoints(
  geometry: Geometry,
  value: unknown,
): RouteEndpoints | undefined {
  if (value == null) return routeEndpoints(geometry);
  if (typeof value !== "object" || Array.isArray(value))
    throw Error("invalidGeometry");
  const v = value as RouteEndpoints;
  const ids = new Set(geometry.flat().map((p) => p.id));
  if (!ids.has(v.startId) || !ids.has(v.endId)) throw Error("invalidGeometry");
  return { startId: v.startId, endId: v.endId };
}
