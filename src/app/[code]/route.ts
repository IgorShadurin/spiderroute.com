import { NextRequest, NextResponse } from "next/server";
import { readShare } from "@/server/routes";
import { shareLocale, sharePath } from "@/lib/sharing";
export const dynamic = "force-dynamic";
export function GET(
  req: NextRequest,
  { params }: { params: Promise<{ code: string }> },
) {
  return params.then(({ code }) => {
    const headers = {
      "Cache-Control": "private, no-store",
      "X-Robots-Tag": "noindex, nofollow",
      "Referrer-Policy": "no-referrer",
    };
    try {
      readShare(code);
    } catch {
      return new NextResponse(null, { status: 404, headers });
    }
    const response = NextResponse.redirect(
      new URL(
        sharePath(
          code,
          shareLocale(
            req.nextUrl.searchParams.get("lang") ?? undefined,
            req.headers.get("host") ?? req.nextUrl.hostname,
          ),
        ),
        "https://app.spiderroute.com",
      ),
      307,
    );
    for (const [key, value] of Object.entries(headers))
      response.headers.set(key, value);
    return response;
  });
}
