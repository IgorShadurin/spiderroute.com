import { getServerSession } from "next-auth";
import { cookies } from "next/headers";
import { authOptions } from "@/server/auth";
import { workspaceAccount, workspaceHomePath } from "@/server/workspace-page";
import { LANGUAGE_KEY, resolveLocale } from "@/lib/language";
import { listSets } from "@/server/item-sets";
import { SetsWorkspace } from "@/components/SetsWorkspace";
export const dynamic = "force-dynamic";
export async function generateMetadata() {
  const account = await workspaceAccount();
  const locale =
    account.locale || resolveLocale((await cookies()).get(LANGUAGE_KEY)?.value);
  return {
    title: locale === "ru" ? "Мои наборы" : "My sets",
    robots: { index: false, follow: false },
  };
}
export default async function SetsPage() {
  const account = await workspaceAccount();
  const locale =
    account.locale || resolveLocale((await cookies()).get(LANGUAGE_KEY)?.value);
  const session = await getServerSession(authOptions);
  return (
    <SetsWorkspace
      initialSets={account.id ? listSets(account.id) : []}
      signedIn={!!account.id}
      locale={locale}
      name={session?.user?.name}
      image={session?.user?.image}
      homeHref={await workspaceHomePath()}
    />
  );
}
