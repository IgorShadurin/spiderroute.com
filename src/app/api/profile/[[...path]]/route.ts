import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/server/auth";
import { sql, rateLimit } from "@/server/db";
import {
  getProfile,
  saveProfile,
  saveAvatar,
  deleteAvatar,
} from "@/server/profiles";
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
const json = (value: unknown, status = 200) =>
  NextResponse.json(value, {
    status,
    headers: {
      "Cache-Control": "private, no-store",
      "X-Robots-Tag": "noindex",
    },
  });
async function body(req: NextRequest, max: number) {
  const reader = req.body?.getReader();
  if (!reader) return Buffer.alloc(0);
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
  return Buffer.concat(chunks);
}
async function handler(
  req: NextRequest,
  { params }: { params: Promise<{ path?: string[] }> },
) {
  try {
    const session = await getServerSession(authOptions);
    const id = (session?.user as { id?: string })?.id;
    if (
      !id ||
      !sql.prepare("SELECT id FROM users WHERE id=? AND disabled=0").get(id)
    )
      return json({ error: "unauthorized" }, 401);
    const path = (await params).path || [];
    if (req.method !== "GET") {
      if (
        req.headers.get("origin") !==
        new URL(process.env.NEXTAUTH_URL || req.url).origin
      )
        return json({ error: "forbidden" }, 403);
      if (!rateLimit("profile:" + id, 40))
        return json({ error: "rateLimited" }, 429);
    }
    if (!path.length && req.method === "GET") return json(getProfile(id));
    if (!path.length && req.method === "PATCH")
      return json(
        saveProfile(id, JSON.parse((await body(req, 12000)).toString())),
      );
    if (path.length === 1 && path[0] === "avatar") {
      if (req.method === "PUT")
        return json(await saveAvatar(id, await body(req, 8 * 1024 * 1024)));
      if (req.method === "DELETE") return json(deleteAvatar(id));
    }
    return json({ error: "notFound" }, 404);
  } catch (e) {
    const code = (e as Error).message;
    return json(
      {
        error: ["fileTooLarge", "invalidImage", "notFound"].includes(code)
          ? code
          : "invalidProfile",
      },
      code === "notFound" ? 404 : 400,
    );
  }
}
export { handler as GET, handler as PATCH, handler as PUT, handler as DELETE };
