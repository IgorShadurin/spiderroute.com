import App from "@/components/App";
import {
  workspaceAccount,
  workspaceMetadata,
  workspaceHomePath,
} from "@/server/workspace-page";
type Props = { params: Promise<{ id: string }> };
export async function generateMetadata({ params }: Props) {
  return workspaceMetadata((await params).id);
}
export default async function RoutePage({ params }: Props) {
  const account = await workspaceAccount();
  return (
    <App
      homeHref={await workspaceHomePath()}
      initialLocale={account.locale}
      initialRouteId={(await params).id}
    />
  );
}
