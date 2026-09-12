"use client";
import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import {
  SessionProvider,
  signIn,
  signOut,
  useSession,
  getProviders,
} from "next-auth/react";
import {
  ArrowLeft,
  ArrowUpRight,
  Check,
  ChevronRight,
  Download,
  Heart,
  MapPin,
  Plus,
  Route,
  ShieldCheck,
  Upload,
  Undo2,
  Redo2,
  Trash2,
  Share2,
  X,
  Menu,
  LogOut,
  MousePointer2,
  Move,
  Scissors,
  PenLine,
} from "lucide-react";
import { NOTE_MAX_LENGTH, validNoteText } from "@/lib/note-limits";
import AnnotationList from "./AnnotationList";
import { sharePath, shareUrl, safeShareReturn } from "@/lib/sharing";
import { Brand } from "./Brand";
import { Illustration } from "./Illustration";
import { messages, type TextKey } from "@/lib/i18n";
import { smoothSection, simplifySection, stats, uid } from "@/lib/geo";
import type {
  Annotation,
  Geometry,
  Locale,
  PublicRoute,
  RouteData,
} from "@/lib/types";
import type { MapMode } from "./RouteMap";
const RouteMap = dynamic(() => import("./RouteMap"), {
  ssr: false,
  loading: () => (
    <div className="map-loading">
      <Route size={32} />
    </div>
  ),
});
async function api(path: string, method = "GET", data?: unknown) {
  const r = await fetch("/api/" + path, {
    method,
    headers: data ? { "Content-Type": "application/json" } : undefined,
    body: data ? JSON.stringify(data) : undefined,
    cache: "no-store",
  });
  const value = await r.json();
  if (!r.ok) throw Error(value.error || "error");
  return value;
}
type AppProps = { token?: string; initialLocale?: Locale };
export default function App({ token, initialLocale }: AppProps) {
  return (
    <SessionProvider>
      <Workspace token={token} initialLocale={initialLocale} />
    </SessionProvider>
  );
}
function Workspace({ token, initialLocale }: AppProps) {
  const { data: session, status } = useSession();
  const [locale, setLocale] = useState<Locale>(initialLocale ?? "en"),
    [routes, setRoutes] = useState<any[]>([]),
    [favorites, setFavorites] = useState<any[]>([]),
    [tab, setTab] = useState<"routes" | "favorites">("routes"),
    [route, setRoute] = useState<RouteData | null>(null),
    [publicRoute, setPublicRoute] = useState<PublicRoute | null>(null),
    [focusedAnnotation, setFocusedAnnotation] = useState<{ id: string }>(),
    [publicError, setPublicError] = useState(false),
    [busy, setBusy] = useState(false),
    [toast, setToast] = useState(""),
    [mobileNav, setMobileNav] = useState(false),
    [mode, setMode] = useState<MapMode>("view"),
    [dirty, setDirty] = useState(false),
    [selected, setSelected] = useState<string>(),
    [end, setEnd] = useState<string>(),
    [choosingEnd, setChoosingEnd] = useState(false),
    [history, setHistory] = useState<RouteData[]>([]),
    [future, setFuture] = useState<RouteData[]>([]),
    [shareOpen, setShareOpen] = useState(false),
    [cloneOpen, setCloneOpen] = useState(false),
    [preview, setPreview] = useState<PublicRoute | null>(null),
    [transform, setTransform] = useState<"smooth" | "simplify" | null>(null),
    [amount, setAmount] = useState(50),
    [transformPreview, setTransformPreview] = useState<Geometry | null>(null),
    [noteOpen, setNoteOpen] = useState(false),
    [noteId, setNoteId] = useState<string>(),
    [noteText, setNoteText] = useState(""),
    [noteColor, setNoteColor] = useState("#ed704c"),
    [providers, setProviders] = useState<any>({});
  const uploadRef = useRef<HTMLInputElement>(null);
  const publicMapRef = useRef<HTMLDivElement>(null);
  const t = messages[locale];
  const text = (key: string) => t[key as TextKey] || t.error;
  const notify = (key: string) => setToast(text(key));
  useEffect(() => {
    const q = new URLSearchParams(location.search).get("lang"),
      stored = localStorage.getItem("spiderroute-language");
    setLocale(
      initialLocale ??
        (q === "ru" || q === "en" ? q : stored === "ru" ? "ru" : "en"),
    );
    getProviders().then(setProviders);
  }, []);
  useEffect(() => {
    document.documentElement.lang = locale;
    localStorage.setItem("spiderroute-language", locale);
  }, [locale]);
  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(""), 6000);
    return () => clearTimeout(id);
  }, [toast]);
  const refresh = async () => {
    const [r, f] = await Promise.all([api("routes"), api("favorites")]);
    setRoutes(r);
    setFavorites(f);
    const initial = new URLSearchParams(location.search).get("route");
    if (initial && !route && r.some((x: any) => x.id === initial)) {
      setRoute(await api("routes/" + initial));
      const target = new URL(location.href);
      target.searchParams.delete("route");
      window.history.replaceState(null, "", target.pathname + target.search);
    }
  };
  useEffect(() => {
    if (status === "authenticated") {
      refresh().catch((e) => notify(e.message));
      api("me")
        .then((u) => {
          if (!token && !new URLSearchParams(location.search).get("lang"))
            setLocale(u.locale === "ru" ? "ru" : "en");
        })
        .catch(() => {});
    }
  }, [status]);
  useEffect(() => {
    if (token)
      api("public/" + token)
        .then(setPublicRoute)
        .catch(() => setPublicError(true));
  }, [token]);
  useEffect(() => {
    const fn = (e: BeforeUnloadEvent) => {
      if (dirty) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", fn);
    return () => window.removeEventListener("beforeunload", fn);
  }, [dirty]);
  useEffect(() => {
    if (!shareOpen && !noteOpen && !cloneOpen) return;
    const dialog = document.querySelector<HTMLElement>("[role=dialog]");
    const previous = document.activeElement as HTMLElement;
    const items = () =>
      Array.from(
        dialog?.querySelectorAll<HTMLElement>(
          "button:not(:disabled),input,textarea,a[href],select",
        ) || [],
      );
    items()[0]?.focus();
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setShareOpen(false);
        setNoteOpen(false);
        setCloneOpen(false);
      }
      if (e.key === "Tab") {
        const nodes = items(),
          first = nodes[0],
          last = nodes.at(-1);
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last?.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
      }
    };
    document.addEventListener("keydown", key);
    return () => {
      document.removeEventListener("keydown", key);
      previous?.focus();
    };
  }, [shareOpen, noteOpen, cloneOpen]);
  const changeLocale = () => {
    const l = locale === "en" ? "ru" : "en";
    if (token) {
      location.assign(sharePath(token, l));
      return;
    }
    setLocale(l);
    if (session) api("me", "PATCH", { locale: l }).catch(() => {});
  };
  const run = async (fn: () => Promise<void>) => {
    if (busy) return;
    setBusy(true);
    try {
      await fn();
    } catch (e) {
      notify((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const accept = (r: RouteData) => {
    setRoute(r);
    setDirty(false);
    setHistory([]);
    setFuture([]);
    setSelected(undefined);
    setEnd(undefined);
    setMode("view");
    setMobileNav(false);
  };
  const openRoute = (id: string) => {
    if (dirty && !confirm(t.discard)) return;
    run(async () => accept(await api("routes/" + id)));
  };
  const update = (r: RouteData) => {
    if (route) setHistory((h) => [...h.slice(-19), structuredClone(route)]);
    setFuture([]);
    setRoute(r);
    setDirty(true);
    setPreview(null);
  };
  const updateGeometry = (g: Geometry) => {
    if (!route) return;
    const ids = new Set(g.flat().map((p) => p.id));
    if (
      route.annotations.some((a) => !ids.has(a.startId) || !ids.has(a.endId))
    ) {
      notify("anchorWarning");
      return;
    }
    update({ ...route, geometry: g, stats: stats(g) });
  };
  const save = async (confirmPrivacy = false) => {
    if (!route) return;
    const saved = await api("routes/" + route.id, "PUT", {
      ...route,
      confirmPrivacy,
    });
    accept(saved);
    await refresh();
    notify("saved");
  };
  const selectPoint = (id: string) => {
    if (choosingEnd && selected) {
      if (
        !route?.geometry.some(
          (s) => s.some((p) => p.id === selected) && s.some((p) => p.id === id),
        )
      ) {
        notify("invalidAnnotations");
        return;
      }
      setEnd(id);
      setChoosingEnd(false);
    } else {
      setSelected(id);
      setEnd(undefined);
    }
  };
  const coordinate = (lat: number, lon: number) => {
    lon = ((lon + 540) % 360) - 180;
    if (!route) return;
    const g = structuredClone(route.geometry),
      p = { id: uid(), lat, lon };
    if (mode === "draw") {
      if (!g.length) g.push([]);
      g.at(-1)!.push(p);
    } else {
      const si = g.findIndex((s) => s.some((p) => p.id === selected));
      if (si < 0) return;
      const pi = g[si].findIndex((p) => p.id === selected);
      if (mode === "move") g[si][pi] = { ...p, id: selected! };
      else if (mode === "insert") g[si].splice(pi + 1, 0, p);
    }
    updateGeometry(g);
  };
  const newDrawing = () => {
    if (dirty && !confirm(t.discard)) return;
    const r: RouteData = {
      id: "new",
      title: t.newRoute,
      geometry: [[]],
      annotations: [],
      stats: stats([]),
      revision: 0,
      privacyStart: 500,
      privacyEnd: 500,
      shared: false,
      updatedAt: new Date().toISOString(),
    };
    accept(r);
    setMode("draw");
  };
  const upload = async (file: File) => {
    if (file.size > 25 * 1024 * 1024) {
      notify("fileTooLarge");
      return;
    }
    if (dirty && !confirm(t.discard)) return;
    await run(async () => {
      accept(
        await api("routes/import", "POST", {
          filename: file.name,
          content: await file.text(),
        }),
      );
      await refresh();
    });
  };
  const previewShare = async () => {
    if (!route) return;
    setPreview(await api("routes/" + route.id + "/preview", "POST", route));
  };
  const startShare = () => {
    if (!route) return;
    if (dirty) {
      notify("saveBeforeShare");
      return;
    }
    setShareOpen(true);
    setPreview(null);
    run(previewShare);
  };
  const publicAction = (action: string) =>
    run(async () => {
      if (!session) {
        location.href =
          "/workspace?lang=" +
          locale +
          "&returnTo=" +
          encodeURIComponent(sharePath(token!, locale));
        return;
      }
      const r = await api("public/" + token + "/" + action, "POST", {});
      notify(action === "clone" ? "cloned" : "favorited");
      if (action === "clone")
        location.href = "/workspace?lang=" + locale + "&route=" + r.id;
    });
  const exportLink = (format: string) =>
    token
      ? `/api/public/${token}/export?format=${format}`
      : `/api/routes/${route?.id}/export?format=${format}`;
  const downloadMenu = (
    <details className="download-menu">
      <summary className={token ? "button light" : "button light small"}>
        <Download size={token ? 17 : 16} />
        {t.export}
      </summary>
      <div>
        {["gpx", "kml", "geojson", "csv"].map((f) => (
          <a
            key={f}
            href={exportLink(f)}
            className={f === "gpx" ? "recommended-format" : undefined}
          >
            <span>{f === "geojson" ? "GeoJSON" : f.toUpperCase()}</span>
            {f === "gpx" && (
              <span className="format-badge">{t.recommended}</span>
            )}
          </a>
        ))}
      </div>
    </details>
  );
  const workspaceHref =
    "/workspace?lang=" +
    locale +
    (!session && token
      ? "&returnTo=" + encodeURIComponent(sharePath(token, locale))
      : "");
  const workspaceLabel = session ? t.myRoutes : t.signInAction;
  const languageButton = (
    <button
      className="language-link"
      onClick={changeLocale}
      aria-label={t.language}
    >
      {locale === "en" ? "RU" : "EN"}
    </button>
  );
  const notifyNode = toast && (
    <div className="toast" role="status">
      <Check size={17} />
      {toast}
      <button onClick={() => setToast("")} aria-label={t.cancel}>
        <X size={15} />
      </button>
    </div>
  );
  if (token)
    return (
      <div className="public-shell">
        <header className="app-header">
          <a href="https://spiderroute.com">
            <Brand />
          </a>
          <div>
            {languageButton}
            <a className="button dark small" href={workspaceHref}>
              {workspaceLabel}
            </a>
          </div>
        </header>
        {publicError ? (
          <div className="center-state">
            <ShieldCheck size={42} />
            <h1>{t.unavailable}</h1>
            <p>{t.unavailableText}</p>
            <a href={workspaceHref} className="button dark">
              {workspaceLabel}
            </a>
          </div>
        ) : !publicRoute ? (
          <div className="center-state">{t.loading}</div>
        ) : (
          <>
            <div className="public-title">
              <div>
                <h1>{publicRoute.title}</h1>
                <div className="public-stats">
                  <span>
                    {(publicRoute.stats.distance / 1000).toFixed(1)}{" "}
                    {locale === "ru" ? "км" : "km"}
                  </span>
                  <span>
                    {publicRoute.stats.segments} {t.segments.toLowerCase()}
                  </span>
                </div>
              </div>
              <div className="action-row">
                <button
                  className="button light"
                  disabled={busy}
                  onClick={() => publicAction("favorite")}
                >
                  <Heart size={17} />
                  {t.favorite}
                </button>
                {downloadMenu}
                <button
                  className="button dark"
                  disabled={busy}
                  onClick={() => setCloneOpen(true)}
                >
                  <Plus size={17} />
                  {t.clone}
                </button>
              </div>
            </div>
            <div className="public-map" ref={publicMapRef}>
              <RouteMap
                locale={locale}
                geometry={publicRoute.geometry}
                annotations={publicRoute.annotations}
                focusAnnotation={focusedAnnotation}
                fitKey={token}
                errorLabel={t.mapUnavailable}
              />
            </div>
            {publicRoute.annotations.length > 0 && (
              <section className="public-notes">
                <h2>{t.annotations}</h2>
                <AnnotationList
                  locale={locale}
                  annotations={publicRoute.annotations}
                  label={t.annotations}
                  onSelect={(a) => {
                    setFocusedAnnotation({ id: a.id });
                    publicMapRef.current?.scrollIntoView({
                      behavior: "smooth",
                      block: "center",
                    });
                  }}
                />
              </section>
            )}
          </>
        )}
        {cloneOpen && publicRoute && (
          <div className="modal-backdrop">
            <section
              className="modal clone-modal"
              role="dialog"
              aria-modal="true"
              aria-labelledby="clone-title"
              aria-describedby="clone-description"
            >
              <div className="modal-header">
                <h2 id="clone-title">{t.cloneConfirmTitle}</h2>
                <button
                  className="icon-button"
                  aria-label={t.cancel}
                  onClick={() => setCloneOpen(false)}
                >
                  <X />
                </button>
              </div>
              <p className="clone-route-name">{publicRoute.title}</p>
              <p id="clone-description" className="subtle">
                {t.cloneConfirmDescription}
              </p>
              <div className="action-row">
                <button
                  className="button light"
                  onClick={() => setCloneOpen(false)}
                >
                  {t.cancel}
                </button>
                <button
                  className="button dark"
                  disabled={busy}
                  onClick={() => {
                    setCloneOpen(false);
                    publicAction("clone");
                  }}
                >
                  <Plus size={17} />
                  {t.clone}
                </button>
              </div>
            </section>
          </div>
        )}
        {notifyNode}
      </div>
    );
  if (status === "loading")
    return (
      <div className="center-state">
        <Brand />
        <p>{t.loading}</p>
      </div>
    );
  if (!session)
    return (
      <div className="signin-shell">
        <header className="site-header">
          <a href="https://spiderroute.com">
            <Brand />
          </a>
          {languageButton}
        </header>
        <main className="signin-main">
          <div className="signin-art">
            <Illustration />
            <div>
              <span className="eyebrow">SPIDERROUTE</span>
              <h2>{t.tagline}</h2>
            </div>
          </div>
          <section className="signin-form">
            <ShieldCheck className="signin-icon" size={34} />
            <h1>{t.signin}</h1>
            <p>{t.signinText}</p>
            {providers?.google && (
              <button
                className="button light full"
                onClick={() => signIn("google", { callbackUrl: "/workspace" })}
              >
                {t.google}
              </button>
            )}
            {providers?.apple && (
              <button
                className="button dark full"
                onClick={() => signIn("apple", { callbackUrl: "/workspace" })}
              >
                {t.apple}
              </button>
            )}
            {!providers?.google && !providers?.apple && (
              <p className="subtle">{t.oauthSoon}</p>
            )}
            <div className="divider">
              <span>{t.demo}</span>
            </div>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const form = new FormData(e.currentTarget);
                run(async () => {
                  const result = await signIn("credentials", {
                    email: form.get("email"),
                    password: form.get("password"),
                    redirect: false,
                  });
                  if (result?.error) throw Error("loginError");
                  const dest = new URLSearchParams(location.search).get(
                    "returnTo",
                  );
                  location.href = safeShareReturn(dest) ?? "/workspace";
                });
              }}
            >
              <label>
                {t.email}
                <input
                  name="email"
                  type="email"
                  required
                  autoComplete="username"
                />
              </label>
              <label>
                {t.password}
                <input
                  name="password"
                  type="password"
                  required
                  autoComplete="current-password"
                />
              </label>
              <button className="button coral full" disabled={busy}>
                {busy ? t.loading : t.login}
                <ArrowUpRight size={17} />
              </button>
            </form>
            <p className="subtle">{t.demoText}</p>
          </section>
        </main>
        {notifyNode}
      </div>
    );
  const canSave = route?.geometry.every((s) => s.length >= 2);
  const selectedPoint = route?.geometry.flat().find((p) => p.id === selected);
  const shownGeometry = transformPreview || route?.geometry || [];
  const openNote = (a?: Annotation) => {
    setNoteId(a?.id);
    setNoteText(a?.text || "");
    setNoteColor(a?.color || "#ed704c");
    if (a) {
      setSelected(a.startId);
      setEnd(a.endId);
    }
    setNoteOpen(true);
  };
  const transformGeometry = () => {
    if (!route || !selected || !end) return;
    const g = structuredClone(route.geometry);
    const si = g.findIndex((s) => s.some((p) => p.id === selected));
    const a = g[si].findIndex((p) => p.id === selected),
      b = g[si].findIndex((p) => p.id === end),
      lo = Math.min(a, b),
      hi = Math.max(a, b);
    const section = g[si].slice(lo, hi + 1);
    g[si].splice(
      lo,
      hi - lo + 1,
      ...(transform === "smooth"
        ? smoothSection(section, amount / 100)
        : simplifySection(section, amount)),
    );
    setTransformPreview(g);
  };
  return (
    <div className="workspace">
      <header className="app-header">
        <button
          className="icon-button mobile-only"
          aria-label="Menu"
          onClick={() => setMobileNav(!mobileNav)}
        >
          <Menu size={22} />
        </button>
        <a href="https://spiderroute.com">
          <Brand />
        </a>
        <div>
          {languageButton}
          <span className="user-avatar" title={session.user?.name || ""}>
            {session.user?.name?.[0]?.toUpperCase() || "S"}
          </span>
          <button
            className="icon-button"
            onClick={() => signOut({ callbackUrl: "/workspace" })}
            title={t.logout}
            aria-label={t.logout}
          >
            <LogOut size={17} />
          </button>
        </div>
      </header>
      <div className="workspace-body">
        <aside className={"library " + (mobileNav ? "mobile-open" : "")}>
          <div className="library-top">
            <span className="eyebrow">
              {locale === "ru" ? "ВАША КОЛЛЕКЦИЯ" : "YOUR COLLECTION"}
            </span>
            <h2>{t.library}</h2>
            <button
              className="button coral full"
              onClick={() => uploadRef.current?.click()}
              disabled={busy}
            >
              <Upload size={17} />
              {t.upload}
            </button>
            <button className="button light full" onClick={newDrawing}>
              <PenLine size={16} />
              {t.draw}
            </button>
            <input
              ref={uploadRef}
              type="file"
              accept=".gpx,.kml,.geojson,.json,.csv"
              hidden
              onChange={(e) => {
                if (e.target.files?.[0]) upload(e.target.files[0]);
                e.target.value = "";
              }}
            />
          </div>
          <div className="library-tabs">
            <button
              className={tab === "routes" ? "active" : ""}
              onClick={() => setTab("routes")}
            >
              <Route size={15} />
              {t.library}
              <span>{routes.length}</span>
            </button>
            <button
              className={tab === "favorites" ? "active" : ""}
              onClick={() => setTab("favorites")}
            >
              <Heart size={15} />
              {t.favorites}
            </button>
          </div>
          <div className="route-list">
            {tab === "routes"
              ? routes.map((r) => (
                  <button
                    key={r.id}
                    className={
                      "route-card " + (route?.id === r.id ? "active" : "")
                    }
                    onClick={() => openRoute(r.id)}
                  >
                    <div className="route-card-icon">
                      <Route size={25} />
                    </div>
                    <div>
                      <strong>{r.title}</strong>
                      <span>
                        {(r.stats.distance / 1000).toFixed(1)}{" "}
                        {locale === "ru" ? "км" : "km"} <i>·</i>{" "}
                        {r.shared ? t.shared : t.privateLabel}
                      </span>
                    </div>
                    <ChevronRight size={15} />
                  </button>
                ))
              : favorites.map((f) => (
                  <div key={f.id} className="favorite-row">
                    {f.available ? (
                      <a href={sharePath(f.token, locale)}>
                        <Heart size={17} />
                        {f.title}
                      </a>
                    ) : (
                      <span>{t.unavailable}</span>
                    )}
                    <button
                      className="icon-button"
                      aria-label={t.removeFavorite}
                      onClick={() =>
                        run(async () => {
                          await api("favorites/" + f.id, "DELETE");
                          await refresh();
                        })
                      }
                    >
                      <X size={16} />
                    </button>
                  </div>
                ))}
          </div>
        </aside>
        <main className="editor">
          {!route ? (
            <div
              className="empty-state"
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                if (e.dataTransfer.files[0]) upload(e.dataTransfer.files[0]);
              }}
            >
              <div className="empty-symbol">
                <Route size={48} />
              </div>
              <h1>{t.empty}</h1>
              <p>{t.emptyText}</p>
              <button
                className="button coral"
                onClick={() => uploadRef.current?.click()}
              >
                <Upload size={18} />
                {t.upload}
              </button>
              <span className="subtle">{t.drop} · 25 MB</span>
            </div>
          ) : (
            <>
              <div className="editor-top">
                <div className="route-title">
                  <input
                    aria-label={t.rename}
                    value={route.title}
                    maxLength={120}
                    onChange={(e) =>
                      update({ ...route, title: e.target.value })
                    }
                  />
                  <span className="route-status">
                    <ShieldCheck size={13} />
                    {route.shared ? t.shared : t.privateLabel}
                    {dirty && <b> · {t.unsaved}</b>}
                  </span>
                </div>
                <div className="action-row">
                  {route.id !== "new" && downloadMenu}
                  {dirty && route.id !== "new" && (
                    <button
                      className="button dark small"
                      disabled={busy || !canSave}
                      onClick={() => run(() => save())}
                    >
                      {t.save}
                    </button>
                  )}
                  {route.id !== "new" && (
                    <button className="button coral small" onClick={startShare}>
                      <Share2 size={16} />
                      {t.share}
                    </button>
                  )}
                </div>
              </div>
              <div className="editor-map">
                <RouteMap
                  locale={locale}
                  geometry={shownGeometry}
                  annotations={route.annotations}
                  selected={selected}
                  endSelected={end}
                  mode={mode}
                  onSelect={selectPoint}
                  onCoordinate={coordinate}
                  fitKey={route.id}
                  errorLabel={t.mapUnavailable}
                />
                <div className="map-toolbar">
                  {mode === "draw" ? (
                    <>
                      <span>{t.drawHelp}</span>
                      <button
                        className="button dark small"
                        disabled={busy || !canSave}
                        onClick={() =>
                          run(async () => {
                            accept(await api("routes", "POST", route));
                            await refresh();
                          })
                        }
                      >
                        {t.finish}
                      </button>
                    </>
                  ) : (
                    <>
                      {[
                        ["view", t.view, Route],
                        ["select", t.select, MousePointer2],
                        ["move", t.move, Move],
                        ["insert", t.insert, Plus],
                      ].map(([m, label, Icon]) => {
                        const I = Icon as typeof Route;
                        return (
                          <button
                            key={String(m)}
                            className={
                              "tool-button " + (mode === m ? "active" : "")
                            }
                            title={String(label)}
                            aria-label={String(label)}
                            onClick={() => setMode(m as MapMode)}
                          >
                            <I size={17} />
                            <span>{String(label)}</span>
                          </button>
                        );
                      })}
                    </>
                  )}
                  <div className="toolbar-divider" />
                  <button
                    className="icon-button"
                    aria-label={t.undo}
                    title={t.undo}
                    disabled={!history.length}
                    onClick={() => {
                      setFuture((f) => [route, ...f]);
                      setRoute(history.at(-1)!);
                      setHistory((h) => h.slice(0, -1));
                      setDirty(true);
                    }}
                  >
                    <Undo2 size={17} />
                  </button>
                  <button
                    className="icon-button"
                    aria-label={t.redo}
                    title={t.redo}
                    disabled={!future.length}
                    onClick={() => {
                      setHistory((h) => [...h, route]);
                      setRoute(future[0]);
                      setFuture((f) => f.slice(1));
                      setDirty(true);
                    }}
                  >
                    <Redo2 size={17} />
                  </button>
                </div>
                {mode !== "view" && mode !== "draw" && (
                  <div className="map-hint">
                    {choosingEnd ? t.range : t.editHelp}
                  </div>
                )}
                {selectedPoint && mode !== "view" && (
                  <div className="point-panel">
                    <div>
                      <strong>{end ? t.segments : t.selected}</strong>
                      <button
                        className="icon-button"
                        aria-label={t.clear}
                        onClick={() => {
                          setSelected(undefined);
                          setEnd(undefined);
                          setChoosingEnd(false);
                        }}
                      >
                        <X size={16} />
                      </button>
                    </div>
                    <span>
                      {selectedPoint.lat.toFixed(5)},{" "}
                      {selectedPoint.lon.toFixed(5)}
                    </span>
                    <div className="point-actions">
                      <button
                        className="button light small"
                        onClick={() => setChoosingEnd(true)}
                      >
                        {t.range}
                      </button>
                      <button
                        className="button dark small"
                        onClick={() => openNote()}
                      >
                        <Plus size={14} />
                        {t.addNote}
                      </button>
                      {end && (
                        <>
                          <button
                            className="button light small"
                            onClick={() => {
                              setTransform("smooth");
                              setAmount(50);
                              setTransformPreview(null);
                            }}
                          >
                            {t.smooth}
                          </button>
                          <button
                            className="button light small"
                            onClick={() => {
                              setTransform("simplify");
                              setAmount(10);
                              setTransformPreview(null);
                            }}
                          >
                            {t.simplify}
                          </button>
                        </>
                      )}
                      <button
                        className="danger-link"
                        onClick={() => {
                          const g = route.geometry.map((s) =>
                            s.filter((p) => p.id !== selected),
                          );
                          if (g.some((s) => s.length < 2)) {
                            notify("invalidGeometry");
                            return;
                          }
                          updateGeometry(g);
                        }}
                      >
                        {t.removePoint}
                      </button>
                    </div>
                  </div>
                )}
              </div>
              <div className="route-details">
                <div className="stats-row">
                  {[
                    [
                      t.distance,
                      (route.stats.distance / 1000).toFixed(2) +
                        (locale === "ru" ? " км" : " km"),
                    ],
                    [t.points, route.stats.points.toLocaleString(locale)],
                    [t.segments, route.stats.segments],
                    [
                      t.ascent,
                      route.stats.ascent === null
                        ? "—"
                        : Math.round(route.stats.ascent) + " " + t.meters,
                    ],
                  ].map(([label, value]) => (
                    <div key={label}>
                      <span>{label}</span>
                      <strong>{value}</strong>
                    </div>
                  ))}
                </div>
                <section className="notes-section">
                  <div className="notes-heading">
                    <h3>
                      <MapPin size={18} />
                      {t.annotations}
                    </h3>
                    <span>{route.annotations.length}</span>
                  </div>
                  {route.annotations.length ? (
                    <AnnotationList
                      locale={locale}
                      annotations={route.annotations}
                      label={t.annotations}
                      onSelect={openNote}
                    />
                  ) : (
                    <p className="subtle">{t.noNotes}</p>
                  )}
                </section>
                <div className="route-bottom">
                  <span>{t.ownerOnly}</span>
                  {route.id !== "new" && (
                    <button
                      className="danger-link"
                      disabled={busy}
                      onClick={() => {
                        if (confirm(t.deleteConfirm))
                          run(async () => {
                            await api("routes/" + route.id, "DELETE");
                            setRoute(null);
                            setDirty(false);
                            await refresh();
                          });
                      }}
                    >
                      <Trash2 size={14} />
                      {t.delete}
                    </button>
                  )}
                </div>
              </div>
            </>
          )}
        </main>
      </div>
      {notifyNode}
      {shareOpen && route && (
        <div className="modal-backdrop">
          <section
            className="modal share-modal"
            role="dialog"
            aria-modal="true"
            aria-label={t.share}
          >
            <div className="modal-header">
              <div>
                <span className="eyebrow">{t.share}</span>
                <h2>{t.shareIntro}</h2>
              </div>
              <button
                className="icon-button"
                aria-label={t.cancel}
                onClick={() => {
                  setShareOpen(false);
                  setPreview(null);
                }}
              >
                <X />
              </button>
            </div>
            <div className="privacy-controls">
              {[
                ["privacyStart", t.start],
                ["privacyEnd", t.end],
              ].map(([key, label]) => (
                <label key={key}>
                  {label}
                  <div>
                    <input
                      type="number"
                      min="0"
                      max="10000"
                      step="50"
                      value={route[key as "privacyStart"]}
                      onChange={(e) => {
                        const n = Number(e.target.value);
                        update({ ...route, [key]: n });
                      }}
                    />
                    <span>{t.meters}</span>
                  </div>
                </label>
              ))}
            </div>
            <p className="subtle">{t.privacyHelp}</p>
            <button
              className="button light full"
              disabled={busy}
              onClick={() => run(previewShare)}
            >
              <ShieldCheck size={16} />
              {t.publicPreview}
            </button>
            <div className="share-preview-map">
              <RouteMap
                locale={locale}
                geometry={preview?.geometry ?? []}
                annotations={preview?.annotations ?? []}
                privacyPreview={{
                  original: route.geometry,
                  start: route.privacyCenters?.start ?? route.geometry[0][0],
                  end:
                    route.privacyCenters?.end ?? route.geometry.at(-1)!.at(-1)!,
                  startRadius: route.privacyStart,
                  endRadius: route.privacyEnd,
                }}
                fitKey={JSON.stringify([
                  route.id,
                  route.privacyStart,
                  route.privacyEnd,
                ])}
              />
            </div>
            <div className="privacy-legend">
              <span>
                <i className="legend-original" />
                {t.originalRoute}
              </span>
              <span>
                <i className="legend-shared" />
                {t.sharedSection}
              </span>
              <span>
                <i className="legend-start" />
                {t.hiddenStart}
              </span>
              <span>
                <i className="legend-finish" />
                {t.hiddenFinish}
              </span>
            </div>
            <p className="subtle">{t.ownerPreview}</p>
            {preview && (
              <p className="subtle">
                {(preview.stats.distance / 1000).toFixed(2)}{" "}
                {locale === "ru" ? "км" : "km"} · {t.publishWarning}
              </p>
            )}
            {route.shared && (
              <div className="share-link">
                <input
                  aria-label="Share URL"
                  readOnly
                  value={
                    typeof location === "undefined"
                      ? ""
                      : shareUrl(route.shareToken!, locale)
                  }
                />
                <button
                  className="button dark small"
                  onClick={() =>
                    run(async () => {
                      await navigator.clipboard.writeText(
                        shareUrl(route.shareToken!, locale),
                      );
                      notify("copied");
                    })
                  }
                >
                  {t.copy}
                </button>
              </div>
            )}
            <div className="action-row">
              {dirty ? (
                <button
                  className="button coral full"
                  disabled={busy || !preview}
                  onClick={() =>
                    run(async () => {
                      await save(true);
                      setShareOpen(false);
                    })
                  }
                >
                  {t.save}
                </button>
              ) : !route.shared ? (
                <button
                  className="button coral full"
                  disabled={busy || !preview}
                  onClick={() =>
                    run(async () => {
                      await api("routes/" + route.id + "/share", "POST", {
                        confirm: true,
                        revision: route.revision,
                      });
                      setRoute(await api("routes/" + route.id));
                      await refresh();
                    })
                  }
                >
                  {t.publish}
                </button>
              ) : null}
              {route.shared && (
                <button
                  className="button light full"
                  disabled={busy}
                  onClick={() =>
                    run(async () => {
                      await api("routes/" + route.id + "/share", "DELETE");
                      setRoute({
                        ...route,
                        shared: false,
                        shareToken: undefined,
                      });
                      await refresh();
                      setShareOpen(false);
                      notify("shareRevoked");
                    })
                  }
                >
                  {t.unshare}
                </button>
              )}
            </div>
            {route.shared && <p className="subtle">{t.liveShare}</p>}
          </section>
        </div>
      )}
      {noteOpen && route && (
        <div className="modal-backdrop">
          <section
            className="modal compact"
            role="dialog"
            aria-modal="true"
            aria-label={t.note}
          >
            <div className="modal-header">
              <h2>{t.note}</h2>
              <button
                className="icon-button"
                aria-label={t.cancel}
                onClick={() => setNoteOpen(false)}
              >
                <X />
              </button>
            </div>
            <label>
              {t.note}
              <textarea
                maxLength={NOTE_MAX_LENGTH}
                aria-describedby="note-length"
                aria-invalid={noteText.length > NOTE_MAX_LENGTH}
                rows={5}
                value={noteText}
                onChange={(e) => setNoteText(e.target.value)}
              />
            </label>
            <p id="note-length" className="note-length">
              {noteText.length} / {NOTE_MAX_LENGTH} {t.characters}
            </p>
            <label className="color-field">
              {t.color}
              <input
                type="color"
                value={noteColor}
                onChange={(e) => setNoteColor(e.target.value)}
              />
            </label>
            <div className="color-presets" role="group" aria-label={t.color}>
              {["#ed704c", "#287b5d", "#4777c5", "#9860ac", "#c69a2d"].map(
                (color) => (
                  <button
                    key={color}
                    type="button"
                    aria-label={`${t.color} ${color}`}
                    aria-pressed={noteColor === color}
                    style={{ backgroundColor: color }}
                    onClick={() => setNoteColor(color)}
                  />
                ),
              )}
            </div>
            <button
              className="button dark full"
              disabled={!selected || !validNoteText(noteText)}
              onClick={() => {
                if (!selected || !validNoteText(noteText)) return;
                const a = {
                  id: noteId || uid(),
                  startId: selected!,
                  endId: end || selected!,
                  text: noteText.trim(),
                  color: noteColor,
                };
                update({
                  ...route,
                  annotations: [
                    ...route.annotations.filter((a) => a.id !== noteId),
                    a,
                  ],
                });
                setNoteOpen(false);
              }}
            >
              {t.saveNote}
            </button>
            {noteId && (
              <button
                className="danger-link"
                onClick={() => {
                  update({
                    ...route,
                    annotations: route.annotations.filter(
                      (a) => a.id !== noteId,
                    ),
                  });
                  setNoteOpen(false);
                }}
              >
                {t.deleteNote}
              </button>
            )}
          </section>
        </div>
      )}
      {transform && route && (
        <div className="transform-panel">
          <div className="modal-header">
            <h3>{transform === "smooth" ? t.smooth : t.simplify}</h3>
            <button
              className="icon-button"
              aria-label={t.cancel}
              onClick={() => {
                setTransform(null);
                setTransformPreview(null);
              }}
            >
              <X size={18} />
            </button>
          </div>
          <label>
            {transform === "smooth" ? t.strength : t.tolerance}: {amount}
            <input
              type="range"
              min="1"
              max={transform === "smooth" ? 100 : 200}
              value={amount}
              onChange={(e) => {
                setAmount(Number(e.target.value));
                setTransformPreview(null);
              }}
            />
          </label>
          <p className="subtle">{t.editedWarning}</p>
          <div className="action-row">
            <button className="button light" onClick={transformGeometry}>
              {t.preview}
            </button>
            <button
              className="button dark"
              disabled={!transformPreview}
              onClick={() => {
                if (transformPreview) updateGeometry(transformPreview);
                setTransformPreview(null);
                setTransform(null);
              }}
            >
              {t.apply}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
