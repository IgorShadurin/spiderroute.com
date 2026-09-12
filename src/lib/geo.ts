import type { Annotation, Geometry, Point, PublicRoute, Stats } from "./types";
export const uid = () => crypto.randomUUID();
const R = 6371008.8;
const rad = Math.PI / 180;
const dlon = (a: number, b: number) => ((b - a + 540) % 360) - 180;
export function distance(a: Point, b: Point): number {
  const x = (b.lat - a.lat) * rad,
    y = dlon(a.lon, b.lon) * rad;
  return (
    2 *
    R *
    Math.asin(
      Math.min(
        1,
        Math.sqrt(
          Math.sin(x / 2) ** 2 +
            Math.cos(a.lat * rad) *
              Math.cos(b.lat * rad) *
              Math.sin(y / 2) ** 2,
        ),
      ),
    )
  );
}
export function stats(g: Geometry): Stats {
  let length = 0,
    ascent = 0,
    hasElevation = false;
  for (const s of g)
    for (let i = 1; i < s.length; i++) {
      length += distance(s[i - 1], s[i]);
      if (s[i].ele !== undefined && s[i - 1].ele !== undefined) {
        hasElevation = true;
        ascent += Math.max(0, s[i].ele! - s[i - 1].ele!);
      }
    }
  return {
    distance: length,
    points: g.reduce((n, s) => n + s.length, 0),
    segments: g.length,
    ascent: hasElevation ? ascent : null,
  };
}
export function validateGeometry(value: unknown): Geometry {
  if (!Array.isArray(value) || !value.length || value.length > 10000)
    throw Error("invalidGeometry");
  let count = 0;
  const ids = new Set<string>();
  const g = value.map((s) => {
    if (!Array.isArray(s) || s.length < 2) throw Error("invalidGeometry");
    return s.map((p) => {
      if (
        !p ||
        !Number.isFinite(p.lat) ||
        !Number.isFinite(p.lon) ||
        Math.abs(p.lat) > 90 ||
        Math.abs(p.lon) > 180
      )
        throw Error("invalidGeometry");
      if (++count > 200000) throw Error("tooManyPoints");
      const id = typeof p.id === "string" && p.id.length <= 80 ? p.id : uid();
      if (ids.has(id)) throw Error("invalidGeometry");
      ids.add(id);
      const point: Point = { id, lat: p.lat, lon: p.lon };
      if (Number.isFinite(p.ele)) point.ele = p.ele;
      if (Number.isFinite(p.speed) && p.speed >= 0) point.speed = p.speed;
      if (typeof p.time === "string" && Number.isFinite(Date.parse(p.time)))
        point.time = new Date(p.time).toISOString();
      return point;
    });
  });
  return g;
}
export function validateAnnotations(value: unknown, g: Geometry): Annotation[] {
  if (!Array.isArray(value) || value.length > 1000)
    throw Error("invalidAnnotations");
  const index = new Map(
    g.flatMap((s, si) => s.map((p, pi) => [p.id, { si, pi }] as const)),
  );
  const ids = new Set();
  return value.map((a) => {
    const start = index.get(a.startId),
      end = index.get(a.endId);
    if (
      !start ||
      !end ||
      start.si !== end.si ||
      typeof a.id !== "string" ||
      a.id.length > 80 ||
      ids.has(a.id) ||
      typeof a.text !== "string" ||
      a.text.length > 2000 ||
      !/^#[0-9a-f]{6}$/i.test(a.color)
    )
      throw Error("invalidAnnotations");
    ids.add(a.id);
    return {
      id: a.id,
      startId: a.startId,
      endId: a.endId,
      text: a.text,
      color: a.color,
    };
  });
}
function interpolate(a: Point, b: Point, t: number): Point {
  return {
    id: uid(),
    lat: a.lat + (b.lat - a.lat) * t,
    lon: ((a.lon + dlon(a.lon, b.lon) * t + 540) % 360) - 180,
  };
}
// Intersections use a local azimuthal distance projection. Safety margin keeps
// boundary samples outside the requested geodesic radius.
function cutIntervals(
  a: Point,
  b: Point,
  c: Point,
  r: number,
): [number, number][] {
  if (r <= 0) return [];
  const xy = (p: Point) => {
    const phi1 = c.lat * rad,
      phi2 = p.lat * rad,
      dl = dlon(c.lon, p.lon) * rad;
    const h = distance(c, p);
    const bearing = Math.atan2(
      Math.sin(dl) * Math.cos(phi2),
      Math.cos(phi1) * Math.sin(phi2) -
        Math.sin(phi1) * Math.cos(phi2) * Math.cos(dl),
    );
    return [h * Math.sin(bearing), h * Math.cos(bearing)];
  };
  const [ax, ay] = xy(a),
    [bx, by] = xy(b),
    dx = bx - ax,
    dy = by - ay,
    A = dx * dx + dy * dy,
    B = 2 * (ax * dx + ay * dy),
    C = ax * ax + ay * ay - (r + 5) ** 2;
  if (A < 1e-12) return C <= 0 ? [[0, 1]] : [];
  const D = B * B - 4 * A * C;
  if (D < 0) return [];
  const lo = Math.max(0, (-B - Math.sqrt(D)) / (2 * A)),
    hi = Math.min(1, (-B + Math.sqrt(D)) / (2 * A));
  return lo < hi ? [[lo, hi]] : [];
}
export function publicSnapshot(
  title: string,
  g: Geometry,
  annotations: Annotation[],
  startRadius: number,
  endRadius: number,
  startCenter?: Point,
  endCenter?: Point,
  revision = 1,
): PublicRoute {
  const first = startCenter ?? g[0][0],
    last = endCenter ?? g.at(-1)!.at(-1)!;
  const zones: [Point, number][] = [
    [first, startRadius],
    [last, endRadius],
  ];
  const output: Geometry = [];
  const originalToPublic = new Map<string, string>();
  const clean = (p: Point, originalId?: string): Point => {
    const id = originalId ? (originalToPublic.get(originalId) ?? uid()) : uid();
    if (originalId) originalToPublic.set(originalId, id);
    return { id, lat: p.lat, lon: p.lon };
  };
  for (const segment of g) {
    let current: Point[] = [];
    const flush = () => {
      if (current.length >= 2) output.push(current);
      current = [];
    };
    for (let i = 1; i < segment.length; i++) {
      const a = segment[i - 1],
        b = segment[i];
      const cuts = zones
        .flatMap(([c, r]) => cutIntervals(a, b, c, r))
        .sort((x, y) => x[0] - y[0]);
      const merged: [number, number][] = [];
      for (const c of cuts) {
        const prev = merged.at(-1);
        if (prev && c[0] <= prev[1]) prev[1] = Math.max(prev[1], c[1]);
        else merged.push([...c]);
      }
      let cursor = 0;
      const visible: [number, number][] = [];
      for (const [lo, hi] of merged) {
        if (lo > cursor) visible.push([cursor, lo]);
        cursor = Math.max(cursor, hi);
      }
      if (cursor < 1) visible.push([cursor, 1]);
      if (!visible.length) {
        flush();
        continue;
      }
      for (let [lo, hi] of visible) {
        const hidden = (t: number) => {
          const p = {
            id: "boundary",
            lat: a.lat + (b.lat - a.lat) * t,
            lon: ((a.lon + dlon(a.lon, b.lon) * t + 540) % 360) - 180,
          };
          return zones.some(([c, r]) => r > 0 && distance(c, p) < r + 1);
        };
        // Long hand-drawn edges can differ from the local projection. Refine
        // their boundary along the actual displayed line instead of dropping
        // an entire visible edge when its approximate intersection is inside.
        if (hidden(lo) || hidden(hi)) {
          const middle = (lo + hi) / 2;
          if (hidden(middle)) {
            flush();
            continue;
          }
          const refine = (inside: number, outside: number) => {
            for (let n = 0; n < 40; n++) {
              const mid = (inside + outside) / 2;
              if (hidden(mid)) inside = mid;
              else outside = mid;
            }
            return outside;
          };
          if (hidden(lo)) lo = refine(lo, middle);
          if (hidden(hi)) hi = refine(hi, middle);
        }
        if (lo > 0) flush();
        const p = lo === 0 ? clean(a, a.id) : clean(interpolate(a, b, lo)),
          q = hi === 1 ? clean(b, b.id) : clean(interpolate(a, b, hi));
        // Fail closed if interpolation differs from the local projection.
        if (
          zones.some(
            ([c, r]) => r > 0 && (distance(c, p) < r || distance(c, q) < r),
          )
        ) {
          flush();
          continue;
        }
        if (!current.length) current.push(p);
        else if (distance(current.at(-1)!, p) > 0.01) {
          flush();
          current.push(p);
        }
        current.push(q);
        if (hi < 1) flush();
      }
    }
    flush();
  }
  if (!output.length) throw Error("nothingToShare");
  const publicAnnotations: Annotation[] = [];
  for (const a of annotations) {
    const start = originalToPublic.get(a.startId),
      end = originalToPublic.get(a.endId);
    if (!start || !end) continue;
    const originalSegment = g.find((s) => s.some((p) => p.id === a.startId));
    if (!originalSegment) continue;
    const ai = originalSegment.findIndex((p) => p.id === a.startId),
      bi = originalSegment.findIndex((p) => p.id === a.endId);
    const allIds = originalSegment
      .slice(Math.min(ai, bi), Math.max(ai, bi) + 1)
      .map((p) => originalToPublic.get(p.id));
    if (
      output.some((s) => {
        const ids = new Set(s.map((p) => p.id));
        return allIds.every((id) => id && ids.has(id));
      })
    )
      publicAnnotations.push({ ...a, id: uid(), startId: start, endId: end });
  }
  return {
    title,
    geometry: output,
    annotations: publicAnnotations,
    stats: stats(output),
    revision,
    protected: startRadius > 0 || endRadius > 0,
  };
}
export function smoothSection(points: Point[], strength = 0.5): Point[] {
  return points.map((p, i) =>
    i === 0 || i === points.length - 1
      ? p
      : {
          id: p.id,
          lat:
            p.lat * (1 - strength) +
            ((points[i - 1].lat + points[i + 1].lat) * strength) / 2,
          lon:
            p.lon +
            (strength *
              (dlon(p.lon, points[i - 1].lon) +
                dlon(p.lon, points[i + 1].lon))) /
              2,
        },
  );
}
export function simplifySection(points: Point[], tolerance = 10): Point[] {
  if (points.length <= 2) return points;
  const keep = new Set([0, points.length - 1]);
  const stack: [[number, number]] | [number, number][] = [
    [0, points.length - 1],
  ];
  while (stack.length) {
    const [lo, hi] = stack.pop()!;
    const a = points[lo],
      b = points[hi];
    let max = tolerance,
      index = -1;
    const bx = dlon(a.lon, b.lon) * rad * R * Math.cos(a.lat * rad),
      by = (b.lat - a.lat) * rad * R;
    for (let i = lo + 1; i < hi; i++) {
      const px = dlon(a.lon, points[i].lon) * rad * R * Math.cos(a.lat * rad),
        py = (points[i].lat - a.lat) * rad * R;
      const t = Math.max(
          0,
          Math.min(1, (px * bx + py * by) / (bx * bx + by * by || 1)),
        ),
        d = Math.hypot(px - t * bx, py - t * by);
      if (d > max) {
        max = d;
        index = i;
      }
    }
    if (index >= 0) {
      keep.add(index);
      stack.push([lo, index], [index, hi]);
    }
  }
  return points.filter((_, i) => keep.has(i));
}
