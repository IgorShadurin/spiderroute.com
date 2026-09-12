import type { Metadata } from "next";
import { headers } from "next/headers";
import {
  ArrowUpRight,
  Github,
  ArrowRight,
  Bike,
  MapPin,
  PencilLine,
  ShieldCheck,
  Copy,
  Plus,
} from "lucide-react";
import { Brand } from "@/components/Brand";
import { landingCopy } from "@/lib/landing";

type Props = { searchParams: Promise<{ lang?: string }> };
async function landingContext(searchParams: Props["searchParams"]) {
  const host = (await headers()).get("host") || "";
  const local = host.includes("localhost") || host.startsWith("127.");
  const locale =
    host.startsWith("ru.") || (local && (await searchParams).lang === "ru")
      ? "ru"
      : "en";
  return { host, local, locale, t: landingCopy[locale] };
}
export async function generateMetadata({
  searchParams,
}: Props): Promise<Metadata> {
  const { locale, t, host } = await landingContext(searchParams);
  const url =
    locale === "ru" ? "https://ru.spiderroute.com" : "https://spiderroute.com";
  return {
    title: { absolute: t.title },
    description: t.description,
    alternates: {
      canonical: url,
      languages: {
        en: "https://spiderroute.com",
        ru: "https://ru.spiderroute.com",
        "x-default": "https://spiderroute.com",
      },
    },
    robots: host.startsWith("app.")
      ? { index: false, follow: false }
      : { index: true, follow: true },
    openGraph: {
      type: "website",
      url,
      siteName: "SpiderRoute",
      title: t.title,
      description: t.description,
      locale: locale === "ru" ? "ru_RU" : "en_US",
      alternateLocale: locale === "ru" ? "en_US" : "ru_RU",
      images: [
        {
          url: `/maps/social-${locale}.png`,
          width: 1200,
          height: 630,
          alt: t.mapAlt,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: t.title,
      description: t.description,
      images: [`/maps/social-${locale}.png`],
    },
  };
}
export default async function Home({ searchParams }: Props) {
  const { host, local, locale, t } = await landingContext(searchParams);
  const ru = locale === "ru";
  if (host.startsWith("app.")) {
    const { redirect } = await import("next/navigation");
    redirect("/workspace");
  }
  const app = local
    ? `/workspace${ru ? "?lang=ru" : ""}`
    : `https://app.spiderroute.com/workspace${ru ? "?lang=ru" : ""}`;
  const url = ru ? "https://ru.spiderroute.com" : "https://spiderroute.com";
  const icons = [PencilLine, MapPin, ShieldCheck, Copy];
  const structuredData = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebSite",
        "@id": `${url}/#website`,
        name: "SpiderRoute",
        url,
        inLanguage: locale,
      },
      {
        "@type": "WebApplication",
        name: "SpiderRoute",
        url: "https://app.spiderroute.com",
        description: t.description,
        applicationCategory: "TravelApplication",
        operatingSystem: "Web browser",
        inLanguage: ["en", "ru"],
        featureList: [...t.tools.map((item) => item.title), t.sourceTitle],
      },
    ],
  };
  return (
    <div className="landing ride-landing" lang={locale}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(structuredData).replace(/</g, "\\u003c"),
        }}
      />
      <header className="site-header">
        <a href="/" aria-label="SpiderRoute">
          <Brand />
        </a>
        <nav>
          <a
            className="language-link"
            href={
              local
                ? `/?lang=${ru ? "en" : "ru"}`
                : ru
                  ? "https://spiderroute.com"
                  : "https://ru.spiderroute.com"
            }
          >
            {ru ? "EN" : "RU"} <span>↗</span>
          </a>
          <a className="button dark small" href={app} aria-label={t.open}>
            <span className="wide-label">{t.open}</span>
            <span className="short-label">{t.shortOpen}</span>
            <ArrowUpRight size={16} />
          </a>
        </nav>
      </header>
      <main>
        <section className="ride-hero">
          <div className="ride-hero-copy">
            <div className="eyebrow">
              <Bike size={18} />
              {t.eyebrow}
            </div>
            <h1>
              {t.hero[0]}
              <br />
              <em>{t.hero[1]}</em>
            </h1>
          </div>
          <div className="ride-hero-description">
            <p className="ride-intro">{t.intro}</p>
            <div className="ride-actions">
              <a className="button coral large" href={app}>
                {t.open}
                <ArrowUpRight size={19} />
              </a>
            </div>
          </div>
          <figure className="london-preview">
            <figcaption className="sport-route-sidebar">
              <span className="eyebrow">{t.mapLocation}</span>
              <h2>{t.mapTitle}</h2>
              <p>
                {t.mapFrom} → {t.mapTo}
              </p>
              <strong className="sport-distance">{t.mapDistance}</strong>
              <p>{t.mapCaption}</p>
              <a
                className="text-link"
                href="https://www.openstreetmap.org/#map=15/51.5062/-0.1143"
                target="_blank"
                rel="noreferrer"
              >
                {t.mapSource}
                <ArrowUpRight size={16} />
              </a>
            </figcaption>
            <div className="london-map">
              <img
                src="/maps/london-c3.webp"
                width="1200"
                height="1120"
                alt={t.mapAlt}
                fetchPriority="high"
              />
              <div className="london-map-heading">
                <span>
                  <Bike size={17} />
                  {t.mapLocation}
                </span>
                <strong>{t.mapDistance}</strong>
              </div>
              <a
                className="map-attribution"
                href="https://www.openstreetmap.org/copyright"
                target="_blank"
                rel="noreferrer"
              >
                © OpenStreetMap contributors
              </a>
            </div>
          </figure>
        </section>
        <section className="ride-tools" id="tools">
          <div className="ride-section-intro">
            <h2>{t.toolsTitle}</h2>
            <p>{t.toolsIntro}</p>
          </div>
          <div className="ride-tool-list">
            {t.tools.map((tool, i) => {
              const Icon = icons[i];
              return (
                <article key={tool.title}>
                  <span className="tool-icon">
                    <Icon size={22} />
                  </span>
                  <div>
                    <h3>{tool.title}</h3>
                    <p>{tool.text}</p>
                  </div>
                </article>
              );
            })}
            <article>
              <span className="tool-icon">
                <Github size={22} />
              </span>
              <div>
                <h3>{t.sourceTitle}</h3>
                <p>{t.sourceText}</p>
                <a
                  className="text-link"
                  href="https://github.com/IgorShadurin/spiderroute.com"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {t.sourceLink}
                  <ArrowUpRight size={16} />
                </a>
              </div>
            </article>
          </div>
        </section>
        <section className="ride-formats" id="formats">
          <div className="formats-heading">
            <h2>{t.formatsTitle}</h2>
            <p>{t.formatsIntro}</p>
          </div>
          <div className="format-grid">
            {t.formats.map((format) => (
              <article key={format.name}>
                <span className="file-extension">{format.name}</span>
                <h3>{format.title}</h3>
                <p>{format.text}</p>
              </article>
            ))}
          </div>
          <p className="file-limits">{t.limits}</p>
        </section>
        <section className="ride-faq">
          <h2>{t.faqTitle}</h2>
          <div>
            {t.faqs.map((faq) => (
              <details key={faq.question}>
                <summary>
                  {faq.question}
                  <Plus size={18} />
                </summary>
                <p>{faq.answer}</p>
              </details>
            ))}
          </div>
        </section>
        <section className="bottom-cta">
          <div>
            <h2>{t.cta}</h2>
            <p>{t.ctaText}</p>
          </div>
          <a className="button dark" href={app}>
            {t.open}
            <ArrowRight size={18} />
          </a>
        </section>
      </main>
      <footer>
        <Brand />
        <span>© {new Date().getFullYear()} SpiderRoute</span>
        <a href="/privacy">{t.privacy}</a>
        <a href="mailto:hello@spiderroute.com">hello@spiderroute.com</a>
      </footer>
    </div>
  );
}
