import { NextRequest, NextResponse } from "next/server";
import { GET as redirectShare } from "../route";
export const dynamic = "force-dynamic";
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ code: string; lang: string }> },
) {
  const { code, lang } = await params;
  if (lang !== "ru" && lang !== "en")
    return new NextResponse(null, { status: 404 });
  const target = req.nextUrl.clone();
  target.searchParams.set("lang", lang);
  return redirectShare(new NextRequest(target), {
    params: Promise.resolve({ code }),
  });
}
