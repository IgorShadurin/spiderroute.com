import { detectChannel } from "@/server/youtube-channel";
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/server/auth";
import { routeOverview } from "@/server/overview";
import { updatePreferences } from "@/server/preferences";
import { sql, rateLimit } from "@/server/db";
import {
  cloneRoute,
  createRoute,
  owned,
  publishRoute,
  revokeShare,
  readShare,
  routeView,
  saveRoute,
  snapshot,
} from "@/server/routes";
import { parseRoute, exportRoute } from "@/lib/formats";
import { postalWebhook } from "@/server/mail";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const json = (data: unknown, status = 200) =>
  NextResponse.json(data, {
    status,
    headers: {
      "Cache-Control": "private, no-store",
      "X-Robots-Tag": "noindex, nofollow",
    },
  });
async function body(req: NextRequest, max = 28 * 1024 * 1024) {
  if (Number(req.headers.get("content-length") || 0) > max)
    throw Error("fileTooLarge");
  const reader = req.body?.getReader();
  if (!reader) return "";
  let length = 0;
  const chunks: Uint8Array[] = [];
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    length += value.length;
    if (length > max) {
      await reader.cancel();
      throw Error("fileTooLarge");
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks).toString("utf8");
}
async function handler(
  req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> },
) {
  try {
    const p = (await params).path,
      method = req.method;
    if (p[0] === "health")
      return json({ ok: sql.prepare("SELECT 1").get() !== undefined });
    if (p[0] === "map-config" && method === "GET")
      return json({
        provider:
          process.env.MAP_PROVIDER === "self-hosted-vector"
            ? "self-hosted-vector"
            : "osm-standard",
        styleUrl: process.env.MAP_STYLE_URL || undefined,
      });
    if (p.join("/") === "postal/webhook" && method === "POST")
      return postalWebhook(
        await body(req, 256000),
        req.headers.get("x-postal-signature-256"),
      )
        ? json({ ok: true })
        : json({ error: "forbidden" }, 403);
    if (p[0] === "public" && method === "GET") {
      const { payload } = readShare(p[1]);
      if (p[2] === "export")
        return download(
          payload.title,
          payload.geometry,
          req.nextUrl.searchParams.get("format") || "gpx",
        );
      return json(payload);
    }
    const session = await getServerSession(authOptions),
      user = (session?.user as any)?.id as string | undefined;
    if (
      !user ||
      !sql.prepare("SELECT id FROM users WHERE id=? AND disabled=0").get(user)
    )
      return json({ error: "unauthorized" }, 401);
    if (method !== "GET") {
      const origin = req.headers.get("origin");
      const allowed = new URL(process.env.NEXTAUTH_URL || req.url).origin;
      if (origin !== allowed) return json({ error: "forbidden" }, 403);
      if (!rateLimit("write:" + user, 90, 60))
        return json({ error: "rateLimited" }, 429);
    }
    if (p[0] === "youtube" && p[1] === "channel" && method === "GET") {
      if (!rateLimit("youtube:" + user, 20, 60))
        return json({ error: "rateLimited" }, 429);
      return json({
        channelId: await detectChannel(
          req.nextUrl.searchParams.get("video") || "",
        ),
      });
    }
    if (p[0] === "me") {
      if (method === "PATCH") {
        const b = JSON.parse(await body(req, 1000));
        updatePreferences(sql, user, b);
      }
      return json(
        sql
          .prepare(
            "SELECT id,name,email,locale,theme,auto_video_highlights AS autoVideoHighlights,youtube_channel AS youtubeChannel FROM users WHERE id=?",
          )
          .get(user),
      );
    }
    if (p[0] === "favorites" && p[1] === "shared" && p.length === 3) {
      const shared = readShare(p[2]);
      if (method === "POST")
        sql
          .prepare("INSERT OR IGNORE INTO favorites VALUES(?,?)")
          .run(user, shared.routeId);
      else if (method === "DELETE")
        sql
          .prepare("DELETE FROM favorites WHERE user_id=? AND route_id=?")
          .run(user, shared.routeId);
      else if (method !== "GET") return json({ error: "notFound" }, 404);
      return json({
        favorite: !!sql
          .prepare("SELECT 1 FROM favorites WHERE user_id=? AND route_id=?")
          .get(user, shared.routeId),
      });
    }
    if (p[0] === "favorites") {
      if (method === "GET")
        return json(
          sql
            .prepare(
              "SELECT r.id,r.updated_at,s.route_id AS shared_id,json_extract(s.payload,'$.title') AS title,json_extract(s.payload,'$.stats.distance') AS distance,COALESCE(l.token,s.token) AS token FROM favorites f JOIN routes r ON r.id=f.route_id LEFT JOIN shares s ON s.route_id=r.id LEFT JOIN share_links l ON l.route_id=r.id WHERE f.user_id=? ORDER BY r.updated_at DESC",
            )
            .all(user)
            .map((r: any) =>
              r.token && r.shared_id
                ? {
                    id: r.id,
                    title: r.title,
                    stats: { distance: r.distance },
                    updatedAt: r.updated_at,
                    token: r.token,
                    available: true,
                  }
                : { id: r.id, available: false },
            ),
        );
      if (method === "DELETE") {
        sql
          .prepare("DELETE FROM favorites WHERE user_id=? AND route_id=?")
          .run(user, p[1]);
        return json({ ok: true });
      }
    }
    if (p[0] === "public" && method === "POST") {
      const shared = readShare(p[1]);
      if (p[2] === "clone") return json(cloneRoute(p[1], user), 201);
      if (p[2] === "favorite") {
        sql
          .prepare("INSERT OR IGNORE INTO favorites VALUES(?,?)")
          .run(user, shared.routeId);
        return json({ ok: true });
      }
    }
    if (p[0] === "routes") {
      if (p[1] === "overview" && method === "GET")
        return json(
          routeOverview(
            sql,
            user,
            (req.nextUrl.searchParams.get("ids") || "").split(","),
          ),
        );
      if (p.length === 1) {
        if (method === "GET")
          return json(
            sql
              .prepare(
                "SELECT r.id,r.title,r.stats,r.revision,r.updated_at,s.token FROM routes r LEFT JOIN shares s ON s.route_id=r.id WHERE r.user_id=? ORDER BY r.updated_at DESC",
              )
              .all(user)
              .map((r: any) => ({
                id: r.id,
                title: r.title,
                stats: JSON.parse(r.stats),
                revision: r.revision,
                updatedAt: r.updated_at,
                shared: !!r.token,
              })),
          );
        if (method === "POST") {
          const b = JSON.parse(await body(req));
          return json(
            createRoute(
              user,
              b.title || "Untitled route",
              b.geometry,
              b.annotations ?? [],
              b.youtubeUrl,
              b.endpoints,
              b.subscription,
            ),
            201,
          );
        }
      }
      if (p[1] === "import" && method === "POST") {
        const b = JSON.parse(await body(req, 32 * 1024 * 1024));
        if (typeof b.content !== "string" || typeof b.filename !== "string")
          throw Error("invalidFile");
        const parsed = parseRoute(b.content, b.filename);
        return json(createRoute(user, parsed.title, parsed.geometry), 201);
      }
      const row = owned(p[1], user);
      if (p[2] === "preview" && method === "POST") {
        const b = JSON.parse(await body(req));
        return json(snapshot(row, b));
      }
      if (p[2] === "share") {
        if (method === "POST") {
          const b = JSON.parse(await body(req, 2000));
          if (b.confirm !== true) throw Error("privacyConfirmation");
          return json({ token: publishRoute(p[1], user, b.revision) });
        }
        if (method === "DELETE") {
          revokeShare(p[1], user);
          return json({ ok: true });
        }
      }
      if (p[2] === "export" && method === "GET")
        return download(
          row.title,
          JSON.parse(row.geometry),
          req.nextUrl.searchParams.get("format") || "gpx",
        );
      if (p.length === 2) {
        if (method === "GET") return json(routeView(row));
        if (method === "PUT")
          return json(saveRoute(p[1], user, JSON.parse(await body(req))));
        if (method === "DELETE") {
          sql
            .prepare("DELETE FROM routes WHERE id=? AND user_id=?")
            .run(p[1], user);
          return json({ ok: true });
        }
      }
    }
    return json({ error: "notFound" }, 404);
  } catch (e) {
    const message = e instanceof Error ? e.message : "";
    const errors = [
      "notFound",
      "conflict",
      "invalidGeometry",
      "tooManyPoints",
      "invalidAnnotations",
      "nothingToShare",
      "invalidTitle",
      "invalidVideo",
      "invalidPrivacy",
      "privacyConfirmation",
      "fileTooLarge",
      "unsupportedFormat",
      "routeLimit",
      "invalidFile",
    ];
    return json(
      { error: errors.includes(message) ? message : "invalidFile" },
      message === "notFound" ? 404 : message === "conflict" ? 409 : 400,
    );
  }
}
function download(title: string, g: any, format: string) {
  const f = exportRoute(title, g, format);
  return new NextResponse(f.body, {
    headers: {
      "Content-Type": f.type + "; charset=utf-8",
      "Content-Disposition": `attachment; filename="route.${f.extension}"`,
      "Cache-Control": "private, no-store",
      "X-Robots-Tag": "noindex, nofollow",
    },
  });
}
export {
  handler as GET,
  handler as POST,
  handler as PUT,
  handler as DELETE,
  handler as PATCH,
};
