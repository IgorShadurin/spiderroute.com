import { redirect } from "next/navigation";
import { workspaceAccount, workspaceHomePath } from "@/server/workspace-page";
import { getProfile } from "@/server/profiles";
import { ProfileEditor } from "@/components/ProfileEditor";
export const dynamic = "force-dynamic";
export const metadata = {
  title: "Profile settings",
  robots: { index: false, follow: false },
};
export default async function SettingsPage() {
  const account = await workspaceAccount();
  if (!account.id) redirect("/workspace");
  return (
    <ProfileEditor
      initial={getProfile(account.id)}
      ru={account.locale === "ru"}
      homeHref={await workspaceHomePath()}
    />
  );
}
