import { headers } from "next/headers";
import {
  ArrowUpRight,
  Upload,
  Route,
  ShieldCheck,
  ArrowRight,
  MapPin,
} from "lucide-react";
import { Brand } from "@/components/Brand";
import { Illustration } from "@/components/Illustration";
import { messages } from "@/lib/i18n";
export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ lang?: string }>;
}) {
  const query = await searchParams;
  const h = await headers(),
    host = h.get("host") || "",
    ru =
      host.startsWith("ru.") ||
      (host.includes("localhost") && query.lang === "ru"),
    t = messages[ru ? "ru" : "en"];
  if (host.startsWith("app.")) {
    const { redirect } = await import("next/navigation");
    redirect("/workspace");
  }
  const local = host.includes("localhost") || host.startsWith("127.");
  const app = local
    ? "/workspace"
    : `https://app.spiderroute.com/workspace${ru ? "?lang=ru" : ""}`;
  return (
    <div className="landing">
      <header className="site-header">
        <a href="/" aria-label="SpiderRoute">
          <Brand />
        </a>
        <nav>
          <a
            className="language-link"
            href={
              local
                ? ru
                  ? "/?lang=en"
                  : "/?lang=ru"
                : ru
                  ? "https://spiderroute.com"
                  : "https://ru.spiderroute.com"
            }
          >
            {ru ? "EN" : "RU"} <span>↗</span>
          </a>
          <a className="button dark small" href={app} aria-label={t.open}>
            <span className="wide-label">{t.open}</span>
            <span className="short-label">{ru ? "Открыть" : "Open"}</span>
            <ArrowUpRight size={16} />
          </a>
        </nav>
      </header>
      <main>
        <section className="hero">
          <div className="hero-copy">
            <div className="eyebrow">
              <span />
              {t.eyebrow}
            </div>
            <h1>
              {t.hero.split("\n")[0]}
              <br />
              <em>{t.hero.split("\n")[1]}</em>
            </h1>
            <p>{t.intro}</p>
            <a className="button coral large" href={app}>
              {t.open}
              <ArrowUpRight size={19} />
            </a>
            <div className="hero-meta">
              <ShieldCheck size={16} />
              {t.private}
              <span>·</span>
              {t.formats}
            </div>
          </div>
          <div className="hero-map">
            <Illustration />
            <div className="map-label">
              <span className="label-icon">
                <Route size={20} />
              </span>
              <div>
                <strong>{t.example}</strong>
                <small>{ru ? "Пешком · 8,4 км" : "On foot · 8.4 km"}</small>
              </div>
              <span className="live-dot" />
            </div>
            <div className="map-mini-label">
              <ShieldCheck size={15} />
              {t.protected}
            </div>
            <span className="synthetic">{t.synthetic}</span>
          </div>
        </section>
        <section className="feature-section">
          <div className="section-heading">
            <span className="eyebrow">01 — SPIDERROUTE</span>
            <h2>{t.own}</h2>
            <p>{t.ownText}</p>
          </div>
          <div className="features">
            {[
              [Upload, t.importTitle, t.importText],
              [MapPin, t.editTitle, t.editText],
              [ShieldCheck, t.shareTitle, t.shareText],
            ].map(([Icon, title, text], i) => {
              const C = Icon as typeof Upload;
              return (
                <article key={i}>
                  <div className="feature-top">
                    <C size={25} />
                    <span>0{i + 1}</span>
                  </div>
                  <h3>{String(title)}</h3>
                  <p>{String(text)}</p>
                </article>
              );
            })}
          </div>
        </section>
        <section className="bottom-cta">
          <h2>{t.footer}</h2>
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
