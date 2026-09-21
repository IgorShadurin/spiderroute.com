"use client";
import { useEffect, useRef, useState } from "react";
import { ArrowUpRight, Check, Copy, Package, X } from "lucide-react";
import { Brand } from "./Brand";
import { SpeedometerLink } from "./SpeedometerLink";
import { ThemeToggle } from "./ThemeProvider";
import { ProfileCard } from "./ProfileCard";
import { MarketplaceLabel } from "./MarketplaceLabel";
import { rememberLanguage } from "@/lib/language";
import {
  countedLabel,
  itemPhotoUrl,
  marketplaceOrder,
  marketplaceUrl,
  type ItemSet,
  type SetItem,
} from "@/lib/item-sets";
import type { PublicProfile } from "@/lib/profile";

export function PublicSetContent({
  set,
  author,
  initialLocale,
}: {
  set: ItemSet;
  author: PublicProfile;
  initialLocale: "ru" | "en";
}) {
  const [locale, setLocale] = useState(initialLocale);
  const [selected, setSelected] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [copyError, setCopyError] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const ru = locale === "ru";
  const active = set.items.find((item) => item.id === selected);
  useEffect(() => {
    const sync = () => {
      const id = window.location.hash.slice(1).replace(/^item-/, "");
      setSelected(set.items.some((item) => item.id === id) ? id : null);
      const lang = new URL(window.location.href).searchParams.get("lang");
      setLocale(lang === "en" || lang === "ru" ? lang : initialLocale);
    };
    sync();
    window.addEventListener("hashchange", sync);
    window.addEventListener("popstate", sync);
    return () => {
      window.removeEventListener("hashchange", sync);
      window.removeEventListener("popstate", sync);
    };
  }, [set.items, initialLocale]);
  useEffect(() => {
    const node = dialog.current;
    if (active && node && !node.open) node.showModal();
    if (!active && node?.open) node.close();
    if (!active) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [active]);
  useEffect(() => {
    if (!copied) return;
    const timer = window.setTimeout(() => setCopied(null), 2500);
    return () => window.clearTimeout(timer);
  }, [copied]);
  function open(id: string) {
    const url = new URL(window.location.href);
    url.hash = `item-${id}`;
    window.history.pushState(null, "", url);
    setSelected(id);
    setCopyError(false);
  }
  function close() {
    const url = new URL(window.location.href);
    url.hash = "";
    window.history.replaceState(null, "", url);
    setSelected(null);
  }
  async function copy(id: string) {
    const url = new URL(window.location.href);
    url.hash = `item-${id}`;
    try {
      await navigator.clipboard.writeText(url.href);
      setCopied(id);
      setCopyError(false);
    } catch {
      setCopyError(true);
    }
  }
  function links(item: SetItem, compact = false) {
    const entries = [
      ...marketplaceOrder(locale)
        .filter((m) => item[m])
        .map((m) => ({
          key: m,
          url: marketplaceUrl(item[m], m),
          label: <MarketplaceLabel market={m} />,
        })),
      ...item.links.map((link, i) => ({
        key: `link-${i}`,
        url: link.url,
        label: link.label,
      })),
    ];
    return (
      <div className="set-item-links">
        {(compact ? entries.slice(0, 4) : entries).map((link) => (
          <a
            key={link.key}
            href={link.url}
            target="_blank"
            rel="noopener noreferrer nofollow ugc"
          >
            {link.label}
            <ArrowUpRight size={15} />
          </a>
        ))}
      </div>
    );
  }
  const image = (item: SetItem, lazy = true) =>
    item.photo ? (
      <img
        src={itemPhotoUrl(item, set.token)}
        alt={item.title}
        loading={lazy ? "lazy" : "eager"}
        width={800}
        height={600}
      />
    ) : (
      <Package size={48} aria-hidden="true" />
    );
  return (
    <div className="sets-page public-collection" lang={locale}>
      <header className="app-header">
        <a href="/">
          <Brand />
        </a>
        <div>
          <SpeedometerLink locale={locale} compact />
          <ThemeToggle locale={locale} />
          <button
            className="icon-button language-link"
            aria-label={ru ? "Язык" : "Language"}
            title={ru ? "English" : "Русский"}
            onClick={() => {
              const next = ru ? "en" : "ru";
              setLocale(next);
              rememberLanguage(next);
              const url = new URL(window.location.href);
              url.searchParams.set("lang", next);
              window.history.replaceState(null, "", url);
            }}
          >
            {ru ? "EN" : "RU"}
          </button>
        </div>
      </header>
      <main className="public-set">
        <div className="sets-eyebrow">
          {ru ? "ПОДБОРКА ВЕЩЕЙ" : "A COLLECTION OF FINDS"}
        </div>
        <h1>{set.title}</h1>
        {set.description && (
          <p className="public-set-description">{set.description}</p>
        )}
        <ProfileCard profile={author} ru={ru} />
        <p className="collection-count">
          {countedLabel(set.items.length, ru)} {ru ? "в наборе" : "in this set"}
        </p>
        <div className="public-item-grid">
          {set.items.map((item) => (
            <article
              className="set-item-card"
              key={item.id}
              id={`item-${item.id}`}
            >
              <a
                className="set-item-photo"
                href={`#item-${item.id}`}
                aria-label={`${ru ? "Подробнее" : "View details"}: ${item.title}`}
                onClick={(event) => {
                  event.preventDefault();
                  open(item.id);
                }}
              >
                {image(item)}
              </a>
              <div className="set-item-content">
                <h2>
                  <a
                    href={`#item-${item.id}`}
                    onClick={(event) => {
                      event.preventDefault();
                      open(item.id);
                    }}
                  >
                    {item.title}
                  </a>
                </h2>
                <p className="item-description-preview">{item.description}</p>
                <div className="item-card-actions">
                  <a
                    className="text-link"
                    href={`#item-${item.id}`}
                    onClick={(event) => {
                      event.preventDefault();
                      open(item.id);
                    }}
                  >
                    {ru ? "Подробнее" : "View details"}
                    <ArrowUpRight size={15} />
                  </a>
                  <button
                    className="icon-button"
                    onClick={() => copy(item.id)}
                    aria-label={`${ru ? "Скопировать ссылку" : "Copy link"}: ${item.title}`}
                    title={ru ? "Ссылка на вещь" : "Link to this item"}
                  >
                    {copied === item.id ? (
                      <Check size={18} />
                    ) : (
                      <Copy size={18} />
                    )}
                  </button>
                </div>
                <footer className="item-card-footer">
                  {links(item, true)}
                </footer>
              </div>
            </article>
          ))}
        </div>
        <p className="collection-copy-status" role="status">
          {copyError
            ? ru
              ? "Не удалось скопировать. Откройте вещь и скопируйте адрес страницы."
              : "Could not copy. Open the item and copy the page address."
            : copied
              ? ru
                ? "Ссылка скопирована"
                : "Link copied"
              : ""}
        </p>
        <footer className="sets-footer">
          {ru
            ? "Собрано и опубликовано в SpiderRoute"
            : "Collected and shared with SpiderRoute"}
        </footer>
      </main>
      <dialog
        ref={dialog}
        className="public-item-dialog"
        aria-labelledby="public-item-title"
        onCancel={(event) => {
          event.preventDefault();
          close();
        }}
        onClick={(event) => {
          if (event.target === event.currentTarget) {
            const rect = event.currentTarget.getBoundingClientRect();
            if (
              event.clientX < rect.left ||
              event.clientX > rect.right ||
              event.clientY < rect.top ||
              event.clientY > rect.bottom
            )
              close();
          }
        }}
      >
        {active && (
          <>
            <header className="item-modal-header">
              <span>{ru ? "ВЕЩЬ ИЗ ПОДБОРКИ" : "FROM THIS COLLECTION"}</span>
              <button
                autoFocus
                className="icon-button"
                aria-label={ru ? "Закрыть" : "Close"}
                onClick={close}
              >
                <X size={22} />
              </button>
            </header>
            <div className="item-modal-body">
              <div className="set-item-photo">{image(active, false)}</div>
              <div className="item-modal-text">
                <h2 id="public-item-title">{active.title}</h2>
                {active.description && <p>{active.description}</p>}
                {links(active)}
                <button
                  className="button light item-modal-copy"
                  onClick={() => copy(active.id)}
                >
                  {copied === active.id ? (
                    <Check size={17} />
                  ) : (
                    <Copy size={17} />
                  )}
                  {copied === active.id
                    ? ru
                      ? "Ссылка скопирована"
                      : "Link copied"
                    : ru
                      ? "Скопировать ссылку на вещь"
                      : "Copy item link"}
                </button>
                {copyError && (
                  <p role="alert">
                    {ru
                      ? "Скопируйте адрес страницы из браузера."
                      : "Copy the page address from your browser."}
                  </p>
                )}
              </div>
            </div>
          </>
        )}
      </dialog>
    </div>
  );
}
