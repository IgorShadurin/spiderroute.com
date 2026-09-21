import { ConfirmationProvider } from "@/components/ConfirmationProvider";
import type { Metadata } from "next";
import { ThemeProvider } from "@/components/ThemeProvider";
import { THEME_KEY, resolveTheme } from "@/lib/theme";
import { cookies, headers } from "next/headers";
import "./globals.css";
export const metadata: Metadata = {
  title: {
    default: "SpiderRoute — Bike & scooter route editor",
    template: "%s · SpiderRoute",
  },
  description:
    "View, edit and share bike, e-bike and scooter routes. Add ride notes and export your GPS tracks.",
  metadataBase: new URL("https://spiderroute.com"),
};
export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const h = await headers();
  const theme = resolveTheme((await cookies()).get(THEME_KEY)?.value);
  const locale =
    h.get("x-spiderroute-locale") === "ru" || h.get("host")?.startsWith("ru.")
      ? "ru"
      : "en";
  return (
    <html lang={locale} data-theme={theme}>
      <body>
        <ThemeProvider initialTheme={theme}>
          <ConfirmationProvider>{children}</ConfirmationProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
