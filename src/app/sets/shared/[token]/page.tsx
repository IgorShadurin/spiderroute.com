import { PublicSetContent } from "@/components/PublicSetContent";
import { setAuthor } from "@/server/profiles";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { cache } from "react";
import { publicSet } from "@/server/item-sets";
import { itemPhotoUrl, setDescription, setSeoTitle } from "@/lib/item-sets";
export const dynamic = "force-dynamic";
type Props = {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ lang?: string }>;
};
const read = cache((token: string) => {
  try {
    return publicSet(token);
  } catch {
    notFound();
  }
});
const origin = () => process.env.NEXTAUTH_URL || "https://app.spiderroute.com";
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { token } = await params;
  const set = read(token);
  const title = setSeoTitle(set);
  const description = setDescription(set);
  const url = new URL(`/sets/shared/${token}`, origin()).href;
  const first = set.items.find((item) => item.photo);
  const images = first
    ? [
        {
          url: new URL(itemPhotoUrl(first, token), origin()).href,
          alt: first.title,
        },
      ]
    : [];
  return {
    title: { absolute: title },
    description,
    alternates: { canonical: url },
    robots: { index: true, follow: true },
    openGraph: {
      title,
      description,
      url,
      type: "website",
      images,
      locale: set.locale === "ru" ? "ru_RU" : "en_US",
    },
    twitter: {
      card: images.length ? "summary_large_image" : "summary",
      title,
      description,
      images: images.map((image) => image.url),
    },
  };
}
export default async function PublicSetPage({ params, searchParams }: Props) {
  const { token } = await params;
  const set = read(token);
  const lang = (await searchParams).lang;
  const locale = lang === "ru" || lang === "en" ? lang : set.locale;
  const author = setAuthor(set.id);
  const data = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: set.title,
    description: setDescription(set),
    url: new URL(`/sets/shared/${token}`, origin()).href,
    inLanguage: set.locale,
    author: {
      "@type": "Person",
      name: [author.firstName, author.lastName].filter(Boolean).join(" "),
      image: author.avatarUrl
        ? new URL(author.avatarUrl, origin()).href
        : undefined,
      sameAs: [
        author.youtube.url,
        author.telegram.url,
        author.instagram.url,
      ].filter(Boolean),
    },
    mainEntity: {
      "@type": "ItemList",
      numberOfItems: set.items.length,
      itemListElement: set.items.map((item, index) => ({
        "@type": "ListItem",
        position: index + 1,
        item: {
          "@type": "Thing",
          name: item.title,
          description: item.description || undefined,
          image: item.photo
            ? new URL(itemPhotoUrl(item, token), origin()).href
            : undefined,
          url: new URL(`/sets/shared/${token}#item-${item.id}`, origin()).href,
        },
      })),
    },
  };
  return (
    <>
      <PublicSetContent set={set} author={author} initialLocale={locale} />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(data).replace(/</g, "\\u003c"),
        }}
      />
    </>
  );
}
