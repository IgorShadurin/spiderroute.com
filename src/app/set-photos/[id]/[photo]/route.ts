import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/server/auth";
import { readItemPhoto } from "@/server/item-sets";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; photo: string }> },
) {
  const { id, photo } = await params;
  const token = req.nextUrl.searchParams.get("share");
  const session = token ? null : await getServerSession(authOptions);
  const headers = {
    "Cache-Control": "private, no-store",
    "X-Content-Type-Options": "nosniff",
  };
  try {
    const bytes = readItemPhoto(
      id,
      photo,
      (session?.user as { id?: string })?.id,
      token,
    );
    return new Response(new Uint8Array(bytes), {
      headers: { ...headers, "Content-Type": "image/webp" },
    });
  } catch {
    return new Response("Not found", { status: 404, headers });
  }
}
