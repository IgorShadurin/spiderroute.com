import App from "@/components/App";
import { workspaceAccount, workspaceMetadata } from "@/server/workspace-page";
type Props = { params: Promise<{ id: string }> };
export async function generateMetadata({ params }: Props) {
  return workspaceMetadata((await params).id);
}
export default async function RoutePage() {
  const account = await workspaceAccount();
  return <App initialLocale={account.locale} />;
}
