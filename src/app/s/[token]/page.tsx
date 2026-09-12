import App from "@/components/App";
import { shareLocale, sharedMetadata } from "@/lib/sharing";
export const dynamic = "force-dynamic";
type Props = {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ lang?: string | string[] }>;
};
export async function generateMetadata({ params, searchParams }: Props) {
  return sharedMetadata(
    (await params).token,
    shareLocale((await searchParams).lang),
  );
}
export default async function SharedPage({ params, searchParams }: Props) {
  return (
    <App
      token={(await params).token}
      initialLocale={shareLocale((await searchParams).lang)}
    />
  );
}
