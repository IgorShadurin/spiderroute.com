import { notifyCreation } from "@/server/creation-notifications";
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { ZodError } from "zod";
import { authOptions } from "@/server/auth";
import { sql, rateLimit } from "@/server/db";
import {
  listSets,
  saveSet,
  ownedSet,
  deleteSet,
  setVisibility,
  saveItem,
  deleteItem,
  saveItemPhoto,
  deleteItemPhoto,
} from "@/server/item-sets";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const json = (value: unknown, status = 200) =>
  NextResponse.json(value, {
    status,
    headers: {
      "Cache-Control": "private, no-store",
      "X-Robots-Tag": "noindex, nofollow",
    },
  });
async function read(req: NextRequest, max: number) {
  if (Number(req.headers.get("content-length") || 0) > max)
    throw Error("fileTooLarge");
  const reader = req.body?.getReader();
  if (!reader) return Buffer.alloc(0);
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > max) {
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
    const user = (session?.user as { id?: string })?.id;
    if (
      !user ||
      !sql.prepare("SELECT id FROM users WHERE id=? AND disabled=0").get(user)
    )
      return json({ error: "unauthorized" }, 401);
    const p = (await params).path || [];
    const method = req.method;
    if (method !== "GET") {
      if (
        req.headers.get("origin") !==
        new URL(process.env.NEXTAUTH_URL || req.url).origin
      )
        return json({ error: "forbidden" }, 403);
      if (!rateLimit("sets:" + user, 90, 60))
        return json({ error: "rateLimited" }, 429);
    }
    if (!p.length && method === "GET") return json(listSets(user));
    if (!p.length && method === "POST") {
      const set = saveSet(
        user,
        JSON.parse((await read(req, 16000)).toString()),
      );
      await notifyCreation("set", set.id, user);
      return json(set, 201);
    }
    if (p.length === 1) {
      if (method === "GET") return json(ownedSet(p[0], user));
      if (method === "PATCH")
        return json(
          saveSet(user, JSON.parse((await read(req, 16000)).toString()), p[0]),
        );
      if (method === "DELETE") {
        deleteSet(p[0], user);
        return json({ ok: true });
      }
    }
    if (p.length === 2 && p[1] === "visibility" && method === "POST") {
      const body = JSON.parse((await read(req, 1000)).toString());
      if (typeof body.public !== "boolean") throw Error("invalidInput");
      return json(setVisibility(p[0], user, body.public));
    }
    if (p[1] === "items") {
      if (p.length === 2 && method === "POST")
        return json(
          saveItem(p[0], user, JSON.parse((await read(req, 40000)).toString())),
          201,
        );
      if (p.length === 3 && method === "PATCH")
        return json(
          saveItem(
            p[0],
            user,
            JSON.parse((await read(req, 40000)).toString()),
            p[2],
          ),
        );
      if (p.length === 3 && method === "DELETE")
        return json(deleteItem(p[0], user, p[2]));
      if (p.length === 4 && p[3] === "photo") {
        // Reject non-owners before buffering or decoding an upload.
        if (!ownedSet(p[0], user).items.some((item) => item.id === p[2]))
          throw Error("notFound");
        if (method === "PUT")
          return json(
            await saveItemPhoto(
              p[0],
              user,
              p[2],
              await read(req, 8 * 1024 * 1024),
            ),
          );
        if (method === "DELETE") return json(deleteItemPhoto(p[0], user, p[2]));
      }
    }
    return json({ error: "notFound" }, 404);
  } catch (error) {
    const code =
      error instanceof ZodError
        ? error.issues.some((issue) => issue.message === "linkRequired")
          ? "linkRequired"
          : "invalidInput"
        : error instanceof SyntaxError
          ? "invalidInput"
          : error instanceof Error
            ? error.message
            : "failed";
    const statuses: Record<string, number> = {
      notFound: 404,
      invalidInput: 400,
      linkRequired: 400,
      invalidImage: 400,
      fileTooLarge: 413,
      limitReached: 400,
      emptySet: 400,
    };
    return json(
      { error: statuses[code] ? code : "failed" },
      statuses[code] || 500,
    );
  }
}
export {
  handler as GET,
  handler as POST,
  handler as PATCH,
  handler as PUT,
  handler as DELETE,
};
