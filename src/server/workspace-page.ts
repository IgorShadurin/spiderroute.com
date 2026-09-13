import { cache } from "react";
import { getServerSession } from "next-auth";
import { authOptions } from "./auth";
import { sql } from "./db";
import { validLocale } from "@/lib/language";
import { owned } from "./routes";
import { routePageTitle } from "@/lib/route-details";

export const workspaceAccount = cache(async () => {
  const session = await getServerSession(authOptions);
  const id = (session?.user as { id?: string })?.id;
  const user = id
    ? (sql
        .prepare("SELECT locale FROM users WHERE id=? AND disabled=0")
        .get(id) as { locale: string } | undefined)
    : undefined;
  return {
    id: user ? id : undefined,
    locale: validLocale(user?.locale) ? user.locale : undefined,
  };
});

export async function workspaceMetadata(routeId?: string) {
  const account = await workspaceAccount();
  let title =
    account.locale === "ru"
      ? "Ваши маршруты · SpiderRoute"
      : "Your routes · SpiderRoute";
  if (routeId && account.id) {
    try {
      title = routePageTitle(owned(routeId, account.id).title);
    } catch {}
  }
  return {
    title: { absolute: title },
    robots: { index: false, follow: false },
  };
}
