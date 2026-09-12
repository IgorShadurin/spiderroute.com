import { randomBytes, randomUUID } from "node:crypto";
import { sql } from "./db";
import {
  publicSnapshot,
  stats,
  validateAnnotations,
  validateGeometry,
} from "@/lib/geo";
import type { Geometry, PublicRoute } from "@/lib/types";
export function owned(id: string, user: string) {
  const row = sql
    .prepare("SELECT * FROM routes WHERE id=? AND user_id=?")
    .get(id, user) as any;
  if (!row) throw Error("notFound");
  return row;
}
export function routeView(row: any) {
  const original: Geometry = JSON.parse(row.original);
  const share = sql
    .prepare("SELECT token FROM shares WHERE route_id=?")
    .get(row.id) as any;
  return {
    id: row.id,
    title: row.title,
    geometry: JSON.parse(row.geometry),
    annotations: JSON.parse(row.annotations),
    stats: JSON.parse(row.stats),
    revision: row.revision,
    privacyStart: row.privacy_start,
    privacyEnd: row.privacy_end,
    privacyCenters: { start: original[0][0], end: original.at(-1)!.at(-1)! },
    shared: !!share,
    shareToken: share?.token,
    updatedAt: row.updated_at,
  };
}
export function createRoute(
  user: string,
  title: string,
  geometry: Geometry,
  annotations: unknown = [],
) {
  const g = validateGeometry(geometry),
    a = validateAnnotations(annotations, g),
    id = randomUUID();
  if (
    (
      sql
        .prepare("SELECT count(*) AS n FROM routes WHERE user_id=?")
        .get(user) as any
    ).n >= 1000
  )
    throw Error("routeLimit");
  sql
    .prepare(
      "INSERT INTO routes(id,user_id,title,geometry,original,annotations,stats,updated_at) VALUES(?,?,?,?,?,?,?,?)",
    )
    .run(
      id,
      user,
      title.trim().slice(0, 120) || "Untitled route",
      JSON.stringify(g),
      JSON.stringify(g),
      JSON.stringify(a),
      JSON.stringify(stats(g)),
      new Date().toISOString(),
    );
  return routeView(owned(id, user));
}
export function snapshot(row: any, overrides?: any): PublicRoute {
  const original: Geometry = JSON.parse(row.original);
  return publicSnapshot(
    overrides?.title ?? row.title,
    overrides?.geometry ?? JSON.parse(row.geometry),
    overrides?.annotations ?? JSON.parse(row.annotations),
    overrides?.privacyStart ?? row.privacy_start,
    overrides?.privacyEnd ?? row.privacy_end,
    original[0][0],
    original.at(-1)!.at(-1)!,
    overrides?.revision ?? row.revision,
  );
}
export function saveRoute(id: string, user: string, input: any) {
  return sql.transaction(() => {
    const row = owned(id, user);
    if (input.revision !== row.revision) throw Error("conflict");
    if (
      typeof input.title !== "string" ||
      !input.title.trim() ||
      input.title.length > 120
    )
      throw Error("invalidTitle");
    for (const n of [input.privacyStart, input.privacyEnd])
      if (!Number.isInteger(n) || n < 0 || n > 10000)
        throw Error("invalidPrivacy");
    const geometry = validateGeometry(input.geometry),
      annotations = validateAnnotations(input.annotations, geometry),
      revision = row.revision + 1;
    const shared = sql
      .prepare("SELECT token FROM shares WHERE route_id=?")
      .get(id);
    if (
      shared &&
      (input.privacyStart < row.privacy_start ||
        input.privacyEnd < row.privacy_end) &&
      input.confirmPrivacy !== true
    )
      throw Error("privacyConfirmation");
    // Generate before mutating. Failed publication rolls back the entire save.
    const payload = shared
      ? JSON.stringify(
          snapshot(row, { ...input, geometry, annotations, revision }),
        )
      : null;
    sql
      .prepare(
        "UPDATE routes SET title=?,geometry=?,annotations=?,stats=?,privacy_start=?,privacy_end=?,revision=?,updated_at=? WHERE id=?",
      )
      .run(
        input.title.trim(),
        JSON.stringify(geometry),
        JSON.stringify(annotations),
        JSON.stringify(stats(geometry)),
        input.privacyStart,
        input.privacyEnd,
        revision,
        new Date().toISOString(),
        id,
      );
    if (payload)
      sql
        .prepare("UPDATE shares SET payload=?,revision=? WHERE route_id=?")
        .run(payload, revision, id);
    return routeView(owned(id, user));
  })();
}
export function publishRoute(id: string, user: string, revision: number) {
  return sql.transaction(() => {
    const row = owned(id, user);
    if (row.revision !== revision) throw Error("conflict");
    const existing = sql
      .prepare("SELECT token FROM shares WHERE route_id=?")
      .get(id) as any;
    if (existing) return existing.token;
    const token = randomBytes(24).toString("base64url");
    sql
      .prepare("INSERT INTO shares VALUES(?,?,?,?,?)")
      .run(
        token,
        id,
        JSON.stringify(snapshot(row)),
        row.revision,
        new Date().toISOString(),
      );
    return token;
  })();
}
const cache = new Map<
  string,
  { revision: number; payload: PublicRoute; size: number }
>();
let cacheBytes = 0;
export function readShare(token: string) {
  if (!/^[A-Za-z0-9_-]{32}$/.test(token)) throw Error("notFound");
  const row = sql
    .prepare("SELECT route_id,revision FROM shares WHERE token=?")
    .get(token) as any;
  if (!row) {
    const old = cache.get(token);
    if (old) {
      cacheBytes -= old.size;
      cache.delete(token);
    }
    throw Error("notFound");
  }
  let cached = cache.get(token);
  if (!cached || cached.revision !== row.revision) {
    const data = sql
      .prepare("SELECT payload FROM shares WHERE token=?")
      .get(token) as any;
    const size = Buffer.byteLength(data.payload);
    if (cached) {
      cacheBytes -= cached.size;
      cache.delete(token);
    }
    cached = {
      revision: row.revision,
      payload: JSON.parse(data.payload),
      size,
    };
    while (
      cache.size &&
      (cacheBytes + size > 32 * 1024 * 1024 || cache.size >= 100)
    ) {
      const key = cache.keys().next().value!;
      cacheBytes -= cache.get(key)!.size;
      cache.delete(key);
    }
    if (size <= 32 * 1024 * 1024) {
      cache.set(token, cached);
      cacheBytes += size;
    }
  }
  return { routeId: row.route_id as string, payload: cached.payload };
}
export function cloneRoute(token: string, user: string) {
  return sql.transaction(() => {
    const { payload } = readShare(token);
    return createRoute(
      user,
      payload.title,
      structuredClone(payload.geometry),
      structuredClone(payload.annotations),
    );
  })();
}
