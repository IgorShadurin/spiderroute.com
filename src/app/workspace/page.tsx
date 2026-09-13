import App from "@/components/App";
import { getServerSession } from "next-auth";
import { authOptions } from "@/server/auth";
import { owned } from "@/server/routes";
import { routePageTitle } from "@/lib/route-details";
export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<{ route?: string; lang?: string }>;
}) {
  const query = await searchParams;
  let title =
    query.lang === "ru"
      ? "Ваши маршруты · SpiderRoute"
      : "Your routes · SpiderRoute";
  if (query.route) {
    const session = await getServerSession(authOptions);
    const id = (session?.user as { id?: string })?.id;
    if (id) {
      try {
        title = routePageTitle(owned(query.route, id).title);
      } catch {}
    }
  }
  return {
    title: { absolute: title },
    robots: { index: false, follow: false },
  };
}
export default function WorkspacePage() {
  return <App />;
}
