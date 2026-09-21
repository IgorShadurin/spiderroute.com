import { setAuthor } from "@/server/profiles";
import { ProfileCard } from "@/components/ProfileCard";
import { MarketplaceLabel } from "@/components/MarketplaceLabel";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { cache } from "react";
import { publicSet } from "@/server/item-sets";
import {
  countedLabel,
  itemPhotoUrl,
  marketplaceUrl,
  marketplaceOrder,
  setDescription,
  setSeoTitle,
} from "@/lib/item-sets";
import { Brand } from "@/components/Brand";
import { ArrowUpRight, Package } from "lucide-react";
export const dynamic = "force-dynamic";
type Props = { params: Promise<{ token: string }> };
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
export default async function PublicSetPage({ params }: Props) {
  const { token } = await params;
  const set = read(token);
  const ru = set.locale === "ru";
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
    <div className="sets-page" lang={set.locale}>
      <header className="sets-header">
        <a href="/">
          <Brand />
        </a>
        <a className="button light" href="/sets">
          {ru ? "Мои наборы" : "My sets"}
          <ArrowUpRight size={16} />
        </a>
      </header>
      <main className="public-set">
        <div className="sets-eyebrow">
          {ru ? "ПОДБОРКА ВЕЩЕЙ" : "A COLLECTION OF FINDS"}
        </div>
        <h1>{set.title}</h1>
        {set.description && (
          <p className="public-set-description">{set.description}</p>
        )}
        <p className="sets-muted">
          {countedLabel(set.items.length, ru)} {ru ? "в наборе" : "in this set"}
        </p>
        <ProfileCard profile={author} ru={ru} />
        <div className="public-item-grid">
          {set.items.map((item) => (
            <article
              className="set-item-card"
              key={item.id}
              id={`item-${item.id}`}
            >
              <div className="set-item-photo">
                {item.photo ? (
                  <img
                    src={itemPhotoUrl(item, token)}
                    alt={item.title}
                    loading="lazy"
                    width="800"
                    height="600"
                  />
                ) : (
                  <Package size={48} aria-hidden="true" />
                )}
              </div>
              <div className="set-item-content">
                <h2>{item.title}</h2>
                {item.description && <p>{item.description}</p>}
                <div className="set-item-links">
                  {marketplaceOrder(set.locale).map(
                    (market) =>
                      item[market] && (
                        <a
                          key={market}
                          href={marketplaceUrl(item[market], market)}
                          target="_blank"
                          rel="noopener noreferrer nofollow ugc"
                        >
                          <MarketplaceLabel market={market} />{" "}
                          <ArrowUpRight size={15} />
                        </a>
                      ),
                  )}
                  {item.links.map((link, i) => (
                    <a
                      key={i}
                      href={link.url}
                      target="_blank"
                      rel="noopener noreferrer nofollow ugc"
                    >
                      {link.label}
                      <ArrowUpRight size={15} />
                    </a>
                  ))}
                </div>
              </div>
            </article>
          ))}
        </div>
        <footer className="sets-footer">
          {ru
            ? "Собрано и опубликовано в SpiderRoute"
            : "Collected and shared with SpiderRoute"}
        </footer>
      </main>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(data).replace(/</g, "\\u003c"),
        }}
      />
    </div>
  );
}
