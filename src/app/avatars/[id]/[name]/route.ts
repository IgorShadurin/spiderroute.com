import { readAvatar } from "@/server/profiles";
export const dynamic = "force-dynamic";
export async function GET(
  _: Request,
  { params }: { params: Promise<{ id: string; name: string }> },
) {
  try {
    const { id, name } = await params;
    return new Response(new Uint8Array(readAvatar(id, name)), {
      headers: {
        "Content-Type": "image/webp",
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return new Response(null, { status: 404 });
  }
}
