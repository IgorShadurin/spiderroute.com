import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/server/auth";
import { sql } from "@/server/db";
import { readShare } from "@/server/routes";
import { placePhotoDir } from "@/server/route-place-store";
import { readFileSync } from "node:fs";
import { join } from "node:path";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; photo: string }> },
) {
  const headers = {
    "Cache-Control": "private, no-store",
    "X-Content-Type-Options": "nosniff",
    "X-Robots-Tag": "noindex",
  };
  try {
    const { id, photo } = await params;
    if (!/^[a-f0-9-]+\.webp$/.test(photo)) throw Error("notFound");
    const token = req.nextUrl.searchParams.get("share");
    if (token) {
      if (
        !readShare(token).payload.places?.some(
          (p) => p.id === id && p.photo === photo,
        )
      )
        throw Error("notFound");
    } else {
      const session = await getServerSession(authOptions);
      const user = (session?.user as { id?: string })?.id;
      if (
        !user ||
        !sql
          .prepare(
            "SELECT p.id FROM route_places p JOIN routes r ON r.id=p.route_id JOIN users u ON u.id=r.user_id WHERE p.id=? AND p.photo=? AND u.id=? AND u.disabled=0",
          )
          .get(id, photo, user)
      )
        throw Error("notFound");
    }
    return new Response(
      new Uint8Array(readFileSync(join(placePhotoDir, photo))),
      { headers: { ...headers, "Content-Type": "image/webp" } },
    );
  } catch {
    return new Response("Not found", { status: 404, headers });
  }
}
