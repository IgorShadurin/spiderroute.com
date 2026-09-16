import { notFound } from "next/navigation";
import { readShare } from "@/server/routes";
import { workspaceHomePath } from "@/server/workspace-page";
import App from "@/components/App";
import { shareLocale, sharedMetadata } from "@/lib/sharing";
export const dynamic = "force-dynamic";
type Props = {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ lang?: string | string[] }>;
};
export async function generateMetadata({ params, searchParams }: Props) {
  const { token } = await params;
  let title: string;
  try {
    title = readShare(token).payload.title;
  } catch {
    notFound();
  }
  return sharedMetadata(token, shareLocale((await searchParams).lang), title);
}
export default async function SharedPage({ params, searchParams }: Props) {
  try {
    readShare((await params).token);
  } catch {
    notFound();
  }
  return (
    <App
      homeHref={await workspaceHomePath()}
      token={(await params).token}
      initialLocale={shareLocale((await searchParams).lang)}
    />
  );
}
