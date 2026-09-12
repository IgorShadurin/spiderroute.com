import App from "@/components/App";
export const dynamic = "force-dynamic";
export const metadata = {
  title: "Shared route",
  robots: { index: false, follow: false },
  referrer: "strict-origin-when-cross-origin" as const,
};
export default async function SharedPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  return <App token={(await params).token} />;
}
