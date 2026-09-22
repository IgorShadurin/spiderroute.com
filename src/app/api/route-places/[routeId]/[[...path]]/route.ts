import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/server/auth";
import { sql, rateLimit } from "@/server/db";
import { owned, routeView, snapshot } from "@/server/routes";
import { placeInput } from "@/lib/route-places";
import { placePhotoDir, removePlacePhoto } from "@/server/route-place-store";
import { randomUUID } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import sharp from "sharp";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const json = (v: unknown, status = 200) =>
  NextResponse.json(v, {
    status,
    headers: { "Cache-Control": "private, no-store" },
  });
async function handler(
  req: NextRequest,
  { params }: { params: Promise<{ routeId: string; path?: string[] }> },
) {
  let fresh: string | null = null;
  try {
    const session = await getServerSession(authOptions);
    const user = (session?.user as { id?: string })?.id;
    if (
      !user ||
      !sql.prepare("SELECT id FROM users WHERE id=? AND disabled=0").get(user)
    )
      return json({ error: "unauthorized" }, 401);
    if (
      req.headers.get("origin") !==
      new URL(process.env.NEXTAUTH_URL || req.url).origin
    )
      return json({ error: "forbidden" }, 403);
    if (!rateLimit("places:" + user, 90, 60))
      return json({ error: "rateLimited" }, 429);
    const { routeId, path = [] } = await params;
    owned(routeId, user);
    if (path.length > 1) return json({ error: "notFound" }, 404);
    const id = path[0] || randomUUID();
    const existing = path[0]
      ? (sql
          .prepare("SELECT * FROM route_places WHERE id=? AND route_id=?")
          .get(id, routeId) as any)
      : null;
    if (
      (req.method !== "POST" && !existing) ||
      (req.method === "POST" && path.length)
    )
      return json({ error: "notFound" }, 404);
    let input: ReturnType<typeof placeInput.parse> | undefined;
    let photo: string | null = null;
    let removeRequested = false;
    let replacedPhoto: string | null = null;
    if (req.method !== "DELETE") {
      const max = 8 * 1024 * 1024 + 32000;
      if (Number(req.headers.get("content-length") || 0) > max)
        return json({ error: "fileTooLarge" }, 413);
      const reader = req.body?.getReader();
      const chunks: Uint8Array[] = [];
      let size = 0;
      if (reader)
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          size += value.length;
          if (size > max) {
            await reader.cancel();
            return json({ error: "fileTooLarge" }, 413);
          }
          chunks.push(value);
        }
      const form = await new Response(Buffer.concat(chunks), {
        headers: { "content-type": req.headers.get("content-type") || "" },
      }).formData();
      const parsed = placeInput.safeParse({
        title: form.get("title"),
        icon: form.get("icon") ?? existing?.icon ?? "pin",
        description: form.get("description") || "",
        lat: Number(form.get("lat")),
        lon: Number(form.get("lon")),
      });
      if (!parsed.success || !form.has("lat") || !form.has("lon"))
        return json({ error: "invalidInput" }, 400);
      input = parsed.data;
      removeRequested = form.get("removePhoto") === "true";
      const file = form.get("photo");
      if (file instanceof File && file.size) {
        if (file.size > 8 * 1024 * 1024)
          return json({ error: "fileTooLarge" }, 413);
        let output: Buffer;
        try {
          const source = sharp(Buffer.from(await file.arrayBuffer()), {
            limitInputPixels: 25_000_000,
            animated: false,
          });
          const metadata = await source.metadata();
          if (
            !["jpeg", "png", "webp", "avif", "heif"].includes(
              metadata.format || "",
            )
          )
            throw Error("format");
          output = await source
            .rotate()
            .resize(1600, 1200, { fit: "inside", withoutEnlargement: true })
            .webp({ quality: 85 })
            .toBuffer();
        } catch {
          return json({ error: "invalidImage" }, 400);
        }
        fresh = randomUUID() + ".webp";
        mkdirSync(placePhotoDir, { recursive: true, mode: 0o700 });
        writeFileSync(join(/* turbopackIgnore: true */ placePhotoDir, fresh), output, {
          flag: "wx",
          mode: 0o600,
        });
        photo = fresh;
      }
    }
    const result = sql
      .transaction(() => {
        owned(routeId, user);
        const current = path[0]
          ? (sql
              .prepare(
                "SELECT photo FROM route_places WHERE id=? AND route_id=?",
              )
              .get(id, routeId) as { photo: string | null } | undefined)
          : undefined;
        if (path[0] && !current) throw Error("notFound");
        replacedPhoto = current?.photo ?? null;
        photo = fresh ?? (removeRequested ? null : replacedPhoto);
        if (req.method === "DELETE")
          sql
            .prepare("DELETE FROM route_places WHERE id=? AND route_id=?")
            .run(id, routeId);
        else if (existing)
          sql
            .prepare(
              "UPDATE route_places SET title=?,description=?,lat=?,lon=?,photo=?,icon=? WHERE id=? AND route_id=?",
            )
            .run(
              input!.title,
              input!.description,
              input!.lat,
              input!.lon,
              photo,
              input!.icon,
              id,
              routeId,
            );
        else {
          if (
            (
              sql
                .prepare("SELECT count(*) n FROM route_places WHERE route_id=?")
                .get(routeId) as { n: number }
            ).n >= 100
          )
            throw Error("limitReached");
          sql
            .prepare(
              "INSERT INTO route_places(id,route_id,title,description,lat,lon,photo,created_at,icon) VALUES(?,?,?,?,?,?,?,?,?)",
            )
            .run(
              id,
              routeId,
              input!.title,
              input!.description,
              input!.lat,
              input!.lon,
              photo,
              new Date().toISOString(),
              input!.icon,
            );
        }
        sql
          .prepare(
            "UPDATE routes SET revision=revision+1,updated_at=? WHERE id=?",
          )
          .run(new Date().toISOString(), routeId);
        const updated = owned(routeId, user);
        if (
          sql.prepare("SELECT token FROM shares WHERE route_id=?").get(routeId)
        )
          sql
            .prepare("UPDATE shares SET payload=?,revision=? WHERE route_id=?")
            .run(JSON.stringify(snapshot(updated)), updated.revision, routeId);
        return routeView(updated);
      })
      .immediate();
    fresh = null;
    if (replacedPhoto && (req.method === "DELETE" || replacedPhoto !== photo))
      removePlacePhoto(replacedPhoto);
    return json(result, req.method === "POST" ? 201 : 200);
  } catch (e) {
    if (fresh) removePlacePhoto(fresh);
    const code = e instanceof Error ? e.message : "failed";
    return json(
      { error: ["notFound", "limitReached"].includes(code) ? code : "failed" },
      code === "notFound" ? 404 : code === "limitReached" ? 400 : 500,
    );
  }
}
export { handler as POST, handler as PATCH, handler as DELETE };
