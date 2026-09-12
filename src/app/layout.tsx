import type { Metadata } from "next";
import { headers } from "next/headers";
import "./globals.css";
export const metadata: Metadata = {
  title: {
    default: "SpiderRoute — Keep the route. Share the adventure.",
    template: "%s · SpiderRoute",
  },
  description:
    "View, edit and share GPS routes. Import GPX, KML, GeoJSON and CSV. Private by default.",
  metadataBase: new URL("https://spiderroute.com"),
};
export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const h = await headers();
  const locale = h.get("host")?.startsWith("ru.") ? "ru" : "en";
  return (
    <html lang={locale}>
      <body>{children}</body>
    </html>
  );
}
