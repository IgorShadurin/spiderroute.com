import { notFound } from "next/navigation";
import SharedPage, { generateMetadata as sharedMetadata } from "../page";
type Props = { params: Promise<{ token: string; lang: string }> };
async function localizedProps({ params }: Props) {
  const { token, lang } = await params;
  if (lang !== "ru" && lang !== "en") notFound();
  return {
    params: Promise.resolve({ token }),
    searchParams: Promise.resolve({ lang }),
  };
}
export async function generateMetadata(props: Props) {
  return sharedMetadata(await localizedProps(props));
}
export default async function LocalizedSharedPage(props: Props) {
  return SharedPage(await localizedProps(props));
}
