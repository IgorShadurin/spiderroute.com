import App from "@/components/App";
import {
  workspaceAccount,
  workspaceMetadata,
  workspaceHomePath,
} from "@/server/workspace-page";
export async function generateMetadata() {
  return workspaceMetadata();
}
export default async function WorkspacePage() {
  const account = await workspaceAccount();
  return (
    <App homeHref={await workspaceHomePath()} initialLocale={account.locale} />
  );
}
