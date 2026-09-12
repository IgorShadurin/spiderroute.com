import { NextResponse, type NextRequest } from "next/server";
export function proxy(req: NextRequest) {
  const host = (req.headers.get("host") || "").split(":")[0];
  if (host === "www.spiderroute.com")
    return NextResponse.redirect(
      new URL(
        req.nextUrl.pathname + req.nextUrl.search,
        "https://spiderroute.com",
      ),
      308,
    );
  if (
    ["spiderroute.com", "ru.spiderroute.com"].includes(host) &&
    (req.nextUrl.pathname.startsWith("/workspace") ||
      req.nextUrl.pathname.startsWith("/s/"))
  ) {
    const target = new URL(
      req.nextUrl.pathname + req.nextUrl.search,
      "https://app.spiderroute.com",
    );
    if (host.startsWith("ru.")) target.searchParams.set("lang", "ru");
    return NextResponse.redirect(target, 307);
  }
  const requestHeaders = new Headers(req.headers);
  requestHeaders.set(
    "x-spiderroute-locale",
    req.nextUrl.pathname.startsWith("/s/")
      ? req.nextUrl.searchParams.get("lang") === "ru"
        ? "ru"
        : "en"
      : host.startsWith("ru.")
        ? "ru"
        : "en",
  );
  return NextResponse.next({ request: { headers: requestHeaders } });
}
export const config = { matcher: ["/((?!api|_next|icon.svg).*)"] };
