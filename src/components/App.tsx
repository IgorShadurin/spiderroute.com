"use client";
import { useEffect, useRef, useState, useCallback } from "react";
import dynamic from "next/dynamic";
import { flushSync } from "react-dom";
import {
  SessionProvider,
  signIn,
  signOut,
  useSession,
  getProviders,
} from "next-auth/react";
import {
  CirclePlay,
  Flag,
  MoreHorizontal,
  CircleAlert,
  TriangleAlert,
  LoaderCircle,
  CircleHelp,
  ArrowLeft,
  ArrowUpRight,
  Check,
  ChevronRight,
  ChevronDown,
  Timer,
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
import { sortLibrary, libraryDate, type LibrarySort } from "@/lib/library-sort";
import {
  parseVideoTime,
  formatVideoTime,
  validVideoTimes,
} from "@/lib/video-time";
import { privateRoutePath, routeIdFromUrl } from "@/lib/navigation";
import { routePageTitle } from "@/lib/route-details";
import { routeEndpoints } from "@/lib/endpoints";
import { activeVideoAnnotations } from "@/lib/video-sync";
import { RouteLoading } from "./RouteLoading";
import { RouteVideo } from "./RouteVideo";
import { NOTE_MAX_LENGTH, validNoteText } from "@/lib/note-limits";
import { useTheme, ThemeToggle } from "./ThemeProvider";
import { resolveTheme, type Theme } from "@/lib/theme";
import { RoutesOverview } from "./RoutesOverview";
import { AccountSettings } from "./AccountSettings";
import { rememberLanguage, storedLanguage, validLocale } from "@/lib/language";
import FavoriteButton from "./FavoriteButton";
import AnnotationList from "./AnnotationList";
import { sharePath, shareUrl, safeShareReturn } from "@/lib/sharing";
import { Brand } from "./Brand";
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
type AppProps = {
  token?: string;
  initialLocale?: Locale;
  initialRouteId?: string;
  homeHref?: string;
};
export default function App({
  token,
  initialLocale,
  initialRouteId,
  homeHref = "/",
}: AppProps) {
  return (
    <SessionProvider>
      <Workspace
        token={token}
        initialLocale={initialLocale}
        initialRouteId={initialRouteId}
        homeHref={homeHref}
      />
    </SessionProvider>
  );
}
function Workspace({
  token,
  initialLocale,
  initialRouteId,
  homeHref = "/",
}: AppProps) {
  const { data: session, status } = useSession();
  const { theme, applyTheme } = useTheme();
  const [locale, setLocale] = useState<Locale>(initialLocale ?? "en"),
    [languageReady, setLanguageReady] = useState(false),
    [accountLocale, setAccountLocale] = useState<Locale>("en"),
    [overviewOpen, setOverviewOpen] = useState(false),
    [routes, setRoutes] = useState<any[]>([]),
    [favorites, setFavorites] = useState<any[]>([]),
    [tab, setTab] = useState<"routes" | "favorites">("routes"),
    [route, setRouteState] = useState<RouteData | null>(null),
    [publicRoute, setPublicRoute] = useState<PublicRoute | null>(null),
    [focusedAnnotation, setFocusedAnnotation] = useState<{ id: string }>(),
    [publicError, setPublicError] = useState(false),
    [busy, setBusy] = useState(false),
    [toast, setToast] = useState<{
      message: string;
      tone: "success" | "error" | "warning";
    } | null>(null),
    [mobileNav, setMobileNav] = useState(false),
    [mode, setMode] = useState<MapMode>("view"),
    [dirty, setDirtyState] = useState(false),
    [selected, setSelected] = useState<string>(),
    [end, setEnd] = useState<string>(),
    [choosingEnd, setChoosingEnd] = useState(false),
    [history, setHistory] = useState<RouteData[]>([]),
    [future, setFuture] = useState<RouteData[]>([]),
    [shareOpen, setShareOpen] = useState(false),
    [publishing, setPublishing] = useState(false),
    [cloneOpen, setCloneOpen] = useState(false),
    [preview, setPreview] = useState<PublicRoute | null>(null),
    [transform, setTransform] = useState<"smooth" | "simplify" | null>(null),
    [amount, setAmount] = useState(50),
    [transformPreview, setTransformPreview] = useState<Geometry | null>(null),
    [noteOpen, setNoteOpen] = useState(false),
    [noteId, setNoteId] = useState<string>(),
    [noteText, setNoteText] = useState(""),
    [noteColor, setNoteColor] = useState("#3b82f6"),
    [providers, setProviders] = useState<any>({});
  const [libraryLoaded, setLibraryLoaded] = useState(false);
  const [sorts, setSorts] = useState<
    Record<"routes" | "favorites", LibrarySort>
  >({ routes: "date-desc", favorites: "date-desc" });
  const [youtubeChannel, setYoutubeChannel] = useState<string | null>(null);
  const [autoVideoHighlights, setAutoVideoHighlights] = useState(true);
  const [playbackTime, setPlaybackTime] = useState<number | null>(null);
  const [segmentStart, setSegmentStart] = useState<string>();
  const [noteEndTime, setNoteEndTime] = useState("");
  const [insertTimed, setInsertTimed] = useState(false);
  const [notePosition, setNotePosition] = useState<Annotation["position"]>();
  const [noteTime, setNoteTime] = useState("");
  const [timeRequired, setTimeRequired] = useState(false);
  const [videoSeek, setVideoSeek] = useState<{
    seconds: number;
    endSeconds?: number;
    nonce: number;
  } | null>(null);
  const seekVideo = useCallback(
    (seconds: number, endSeconds?: number) =>
      setVideoSeek({ seconds, endSeconds, nonce: Date.now() }),
    [],
  );
  useEffect(() => {
    if (mode !== "segment") return;
    const cancel = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setSegmentStart(undefined);
      setSelected(undefined);
      setEnd(undefined);
      setMode("view");
    };
    document.addEventListener("keydown", cancel);
    return () => document.removeEventListener("keydown", cancel);
  }, [mode]);
  const insertionMenu = useRef<HTMLDetailsElement>(null);
  const routeRef = useRef<RouteData | null>(null);
  const dirtyRef = useRef(false);
  const saveFlight = useRef<Promise<void> | null>(null);
  const navigationVersion = useRef(0);
  const [routeLoad, setRouteLoad] = useState<{
    id: string;
    status: "loading" | "error";
  } | null>(initialRouteId ? { id: initialRouteId, status: "loading" } : null);
  const [titleEditing, setTitleEditing] = useState(false);
  const titleEditingRef = useRef(false);
  const titleBeforeEdit = useRef("");
  const [autoSaving, setAutoSaving] = useState(false);
  const [saveFailed, setSaveFailed] = useState(false);
  const setRoute = (value: RouteData | null) => {
    routeRef.current = value;
    setRouteState(value);
  };
  const setDirty = (value: boolean) => {
    dirtyRef.current = value;
    setDirtyState(value);
  };
  const setRouteUrl = (id?: string, replace = false) => {
    const url = new URL(location.href);
    url.pathname = id && id !== "new" ? privateRoutePath(id) : homeHref;
    url.search = "";
    if (url.href !== location.href)
      window.history[replace ? "replaceState" : "pushState"](
        null,
        "",
        url.pathname + url.search,
      );
  };
  const routeMenuRef = useRef<HTMLDetailsElement>(null);
  const downloadRef = useRef<HTMLDetailsElement>(null);
  const positionInsertionMenu = () => {
    const menu = insertionMenu.current;
    const panel = menu?.querySelector<HTMLDivElement>(":scope > div");
    if (!menu?.open || !panel) return;
    const trigger = menu.getBoundingClientRect();
    const bounds = menu.closest(".editor-map")?.getBoundingClientRect();
    const min = Math.max(8, (bounds?.left ?? 0) + 8);
    const max =
      Math.min(
        window.innerWidth - 8,
        (bounds?.right ?? window.innerWidth) - 8,
      ) - panel.offsetWidth;
    panel.style.left = `${Math.max(min, Math.min(trigger.left, max)) - trigger.left}px`;
  };
  useEffect(() => {
    const outside = (event: PointerEvent) => {
      for (const menu of [
        downloadRef.current,
        routeMenuRef.current,
        insertionMenu.current,
      ]) {
        if (menu?.open && !event.composedPath().includes(menu))
          menu.open = false;
      }
    };
    const escape = (event: KeyboardEvent) => {
      const menu = insertionMenu.current?.open
        ? insertionMenu.current
        : routeMenuRef.current?.open
          ? routeMenuRef.current
          : downloadRef.current;
      if (event.key === "Escape" && menu?.open) {
        menu.open = false;
        menu.querySelector("summary")?.focus();
        event.preventDefault();
      }
    };
    window.addEventListener("resize", positionInsertionMenu);
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", escape);
    return () => {
      window.removeEventListener("resize", positionInsertionMenu);
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("keydown", escape);
    };
  }, []);
  const [importProgress, setImportProgress] = useState<{
    filename: string;
    stage: "reading" | "importing" | "preparing";
  } | null>(null);
  const importWorker = useRef<Worker | null>(null);
  useEffect(() => () => importWorker.current?.terminate(), []);
  const uploadRef = useRef<HTMLInputElement>(null);
  const publicMapRef = useRef<HTMLDivElement>(null);
  const editorMapRef = useRef<HTMLDivElement>(null);
  const currentVideoNotes = token
    ? (publicRoute?.annotations ?? [])
    : (route?.annotations ?? []);
  const currentVideoUrl = token ? publicRoute?.youtubeUrl : route?.youtubeUrl;
  const activeAnnotations =
    autoVideoHighlights && currentVideoUrl
      ? activeVideoAnnotations(currentVideoNotes, playbackTime)
      : [];
  const hasVideoNotes = currentVideoNotes.some(
    (note) => note.videoSeconds !== undefined,
  );
  const highlightSaveQueue = useRef(Promise.resolve());
  const highlightSaveVersion = useRef(0);
  const changeVideoHighlights = async (enabled: boolean) => {
    const version = ++highlightSaveVersion.current;
    const before = autoVideoHighlights;
    setAutoVideoHighlights(enabled);
    try {
      if (session) {
        const save = highlightSaveQueue.current
          .catch(() => {})
          .then(() => api("me", "PATCH", { autoVideoHighlights: enabled }));
        highlightSaveQueue.current = save.then(
          () => {},
          () => {},
        );
        await save;
      } else
        localStorage.setItem("spiderroute-video-highlights", String(enabled));
    } catch {
      if (version === highlightSaveVersion.current)
        setAutoVideoHighlights(before);
      notify("error");
    }
  };
  const t = messages[locale];
  const text = (key: string) => t[key as TextKey] || t.error;
  const notify = (key: string) =>
    setToast({
      message: text(key),
      tone: ["saved", "copied", "cloned", "favorited", "shareRevoked"].includes(
        key,
      )
        ? "success"
        : ["anchorWarning", "saveBeforeShare"].includes(key)
          ? "warning"
          : "error",
    });
  useEffect(() => {
    const q = new URLSearchParams(location.search).get("lang"),
      stored = storedLanguage();
    setLocale(
      initialLocale ?? (token && (q === "ru" || q === "en") ? q : stored),
    );
    try {
      setAutoVideoHighlights(
        localStorage.getItem("spiderroute-video-highlights") !== "false",
      );
    } catch {}
    setLanguageReady(true);
    getProviders().then(setProviders);
  }, []);
  useEffect(() => {
    if (!languageReady) return;
    document.documentElement.lang = locale;
    rememberLanguage(locale);
  }, [locale, languageReady]);
  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(null), 6000);
    return () => clearTimeout(id);
  }, [toast]);
  const refresh = async () => {
    const [r, f] = await Promise.all([api("routes"), api("favorites")]);
    setRoutes(r);
    setFavorites(f);
    setLibraryLoaded(true);
  };
  useEffect(() => {
    if (status === "authenticated") {
      refresh().catch((e) => notify(e.message));
      api("me")
        .then((u) => {
          const saved = validLocale(u.locale) ? u.locale : "en";
          setAutoVideoHighlights(!!(u.autoVideoHighlights ?? 1));
          setYoutubeChannel(u.youtubeChannel ?? null);
          setAccountLocale(saved);
          applyTheme(resolveTheme(u.theme));
          if (!token) {
            setLocale(saved);
            const target = new URL(location.href);
            target.searchParams.delete("lang");
            window.history.replaceState(
              null,
              "",
              target.pathname + target.search,
            );
          }
        })
        .catch(() => {});
    }
  }, [status]);
  useEffect(() => {
    if (status !== "authenticated" || token) return;
    const load = async () => {
      const version = ++navigationVersion.current;
      const id = routeIdFromUrl(new URL(location.href));
      setRouteLoad(id ? { id, status: "loading" } : null);
      try {
        if (dirtyRef.current) await save();
        if (version !== navigationVersion.current) return;
        if (!id) {
          setRoute(null);
          setDirty(false);
          return;
        }
        const loaded = await api("routes/" + encodeURIComponent(id));
        if (version === navigationVersion.current) {
          accept(loaded, false);
          setRouteLoad(null);
        }
      } catch (error) {
        if (version === navigationVersion.current) {
          notify((error as Error).message);
          if (!dirtyRef.current) {
            setRoute(null);
            setRouteLoad(id ? { id, status: "error" } : null);
          } else setRouteLoad(null);
        }
      }
    };
    void load();
    window.addEventListener("popstate", load);
    return () => {
      navigationVersion.current++;
      window.removeEventListener("popstate", load);
    };
  }, [status, token]);
  useEffect(() => {
    if (!token)
      document.title = route
        ? routePageTitle(route.title)
        : locale === "ru"
          ? "Ваши маршруты · SpiderRoute"
          : "Your routes · SpiderRoute";
  }, [route?.title, locale, token]);
  useEffect(() => {
    if (!dirty || titleEditing || shareOpen || !route || route.id === "new")
      return;
    const timer = setTimeout(() => {
      void save(false, false).catch((error) => notify(error.message));
    }, 500);
    return () => clearTimeout(timer);
  }, [route, dirty, titleEditing, shareOpen]);
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
  const saveAccountLanguage = async (l: Locale, nextTheme?: Theme) => {
    await api("me", "PATCH", {
      locale: l,
      ...(nextTheme ? { theme: nextTheme } : {}),
    });
    if (nextTheme) applyTheme(nextTheme);
    setAccountLocale(l);
    setLocale(l);
    rememberLanguage(l);
    const target = new URL(location.href);
    if (token) {
      target.pathname = sharePath(token, l);
      target.search = "";
    } else target.searchParams.delete("lang");
    window.history.replaceState(null, "", target.pathname + target.search);
  };
  const changeLocale = () => {
    const l = locale === "en" ? "ru" : "en";
    if (token) {
      rememberLanguage(l);
      location.assign(sharePath(token, l));
      return;
    }
    if (session) {
      saveAccountLanguage(l).catch(() => notify("error"));
      return;
    }
    setLocale(l);
    rememberLanguage(l);
    const target = new URL(location.href);
    if (token) target.searchParams.set("lang", l);
    else target.searchParams.delete("lang");
    window.history.replaceState(null, "", target.pathname + target.search);
  };
  const startOAuth = (provider: string) => {
    rememberLanguage(locale);
    return signIn(provider, {
      callbackUrl: location.pathname + location.search,
    });
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
  const accept = (r: RouteData, navigate = true) => {
    setRouteLoad(null);
    setFocusedAnnotation(undefined);
    setSegmentStart(undefined);
    setVideoSeek(null);
    setPlaybackTime(null);
    if (navigate) setRouteUrl(r.id);
    setSaveFailed(false);
    setOverviewOpen(false);
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
    run(async () => {
      const version = ++navigationVersion.current;
      setRouteLoad({ id, status: "loading" });
      setOverviewOpen(false);
      setMobileNav(false);
      try {
        await save();
        if (version !== navigationVersion.current) return;
        const loaded = await api("routes/" + encodeURIComponent(id));
        if (version === navigationVersion.current) accept(loaded);
      } catch (error) {
        if (version === navigationVersion.current)
          setRouteLoad(dirtyRef.current ? null : { id, status: "error" });
        throw error;
      }
    });
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
    update({
      ...route,
      geometry: g,
      endpoints: routeEndpoints(g, route.endpoints),
      stats: stats(g),
    });
  };
  const save = async (
    confirmPrivacy = false,
    allowFocusedTitle = true,
  ): Promise<void> => {
    while (saveFlight.current) await saveFlight.current;
    if (!dirtyRef.current || !routeRef.current || routeRef.current.id === "new")
      return;
    const task = async () => {
      setAutoSaving(true);
      setSaveFailed(false);
      try {
        while (
          dirtyRef.current &&
          routeRef.current &&
          routeRef.current.id !== "new"
        ) {
          if (!allowFocusedTitle && titleEditingRef.current) return;
          const submitted = routeRef.current;
          const saved = await api("routes/" + submitted.id, "PUT", {
            ...submitted,
            confirmPrivacy,
          });
          if (routeRef.current?.id !== submitted.id) return;
          if (routeRef.current === submitted) {
            setRoute(saved);
            setDirty(false);
          } else setRoute({ ...routeRef.current, revision: saved.revision });
        }
        void refresh().catch(() => {});
      } catch (error) {
        setSaveFailed(true);
        throw error;
      } finally {
        setAutoSaving(false);
      }
    };
    const flight = task();
    saveFlight.current = flight;
    try {
      await flight;
    } finally {
      if (saveFlight.current === flight) saveFlight.current = null;
    }
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
  const coordinate = (lat: number, lon: number, anchorId?: string) => {
    lon = ((lon + 540) % 360) - 180;
    if (!route) return;
    if (mode === "segment") {
      if (!anchorId) return;
      if (!segmentStart) {
        setSegmentStart(anchorId);
        setSelected(anchorId);
        setEnd(undefined);
        return;
      }
      if (
        anchorId === segmentStart ||
        !route.geometry.some(
          (s) =>
            s.some((p) => p.id === segmentStart) &&
            s.some((p) => p.id === anchorId),
        )
      )
        return;
      setSelected(segmentStart);
      setEnd(anchorId);
      setSegmentStart(undefined);
      setNoteId(undefined);
      setNotePosition(undefined);
      setNoteText(locale === "ru" ? "Участок" : "Segment");
      setNoteColor("#3b82f6");
      setNoteTime("");
      setNoteEndTime("");
      setTimeRequired(insertTimed && !!route.youtubeUrl);
      setNoteOpen(true);
      setMode("view");
      return;
    }
    if (mode === "insert" || mode === "pin") {
      const points = route.geometry.flat();
      const closest = points.reduce(
        (best, p) =>
          Math.hypot(p.lat - lat, p.lon - lon) <
          Math.hypot(best.lat - lat, best.lon - lon)
            ? p
            : best,
        points[0],
      );
      if (!closest) return;
      setSelected(closest.id);
      setEnd(undefined);
      setNoteId(undefined);
      setNoteText(locale === "ru" ? "Метка" : "Marker");
      setNoteColor("#3b82f6");
      setNotePosition({ lat, lon });
      setNoteTime("");
      setNoteEndTime("");
      setTimeRequired(insertTimed && !!route.youtubeUrl);
      setNoteOpen(true);
      setMode("view");
      return;
    }
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
    setSegmentStart(undefined);
    setMode("draw");
  };
  const upload = async (file: File) => {
    if (file.size > 25 * 1024 * 1024) {
      notify("fileTooLarge");
      return;
    }
    if (dirty && !confirm(t.discard)) return;
    if (busy || importWorker.current) return;
    flushSync(() => {
      setBusy(true);
      setMobileNav(false);
      setImportProgress({ filename: file.name, stage: "reading" });
    });
    // Paint feedback before starting any work, even for small files.
    await new Promise<void>((resolve) =>
      requestAnimationFrame(() => setTimeout(resolve, 0)),
    );
    try {
      const imported = await new Promise<RouteData>((resolve, reject) => {
        const worker = new Worker(
          new URL("../lib/import-route.worker.ts", import.meta.url),
        );
        importWorker.current = worker;
        worker.onmessage = ({ data }) => {
          if (data.error) reject(new Error(data.error));
          else {
            setImportProgress({ filename: file.name, stage: data.stage });
            if (data.route) resolve(data.route);
          }
        };
        worker.onerror = () => reject(new Error("error"));
        worker.postMessage(file);
      });
      flushSync(() => accept(imported));
      await new Promise<void>((resolve) =>
        requestAnimationFrame(() => setTimeout(resolve, 0)),
      );
      // The import is already saved; a library refresh must not hold up the map.
      void refresh().catch(() => notify("error"));
    } catch (error) {
      notify((error as Error).message);
    } finally {
      (importWorker.current as Worker | null)?.terminate();
      importWorker.current = null;
      setImportProgress(null);
      setBusy(false);
    }
  };
  const previewShare = async () => {
    const current = routeRef.current;
    if (!current) return;
    setPreview(await api("routes/" + current.id + "/preview", "POST", current));
  };
  const startShare = () => {
    if (!route) return;
    run(async () => {
      await save();
      setShareOpen(true);
      setPreview(null);
      await previewShare();
    });
  };
  const publicAction = (action: string) =>
    run(async () => {
      if (!session) {
        location.href =
          homeHref +
          "?returnTo=" +
          encodeURIComponent(sharePath(token!, locale));
        return;
      }
      const r = await api("public/" + token + "/" + action, "POST", {});
      notify(action === "clone" ? "cloned" : "favorited");
      if (action === "clone") location.href = privateRoutePath(r.id);
    });
  const exportLink = (format: string) =>
    token
      ? `/api/public/${token}/export?format=${format}`
      : `/api/routes/${route?.id}/export?format=${format}`;
  const downloadMenu = (
    <details ref={downloadRef} className="download-menu">
      <summary className={token ? "button light" : "button light small"}>
        <Download size={token ? 17 : 16} />
        {t.export}
      </summary>
      <div>
        {["gpx", "kml", "geojson", "csv"].map((f) => (
          <a
            key={f}
            href={exportLink(f)}
            onClick={() => {
              if (downloadRef.current) downloadRef.current.open = false;
            }}
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
    homeHref +
    (!session && token
      ? "?returnTo=" + encodeURIComponent(sharePath(token, locale))
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
    <div
      className={"toast toast-" + toast.tone}
      role={toast.tone === "error" ? "alert" : "status"}
    >
      {toast.tone === "error" ? (
        <CircleAlert size={20} aria-hidden="true" />
      ) : toast.tone === "warning" ? (
        <TriangleAlert size={20} aria-hidden="true" />
      ) : (
        <Check size={20} aria-hidden="true" />
      )}
      <span>{toast.message}</span>
      <button onClick={() => setToast(null)} aria-label={t.cancel}>
        <X size={15} />
      </button>
    </div>
  );
  if (token)
    return (
      <div
        className={`public-shell${publicRoute?.youtubeUrl ? " has-video" : ""}`}
      >
        <header className="app-header">
          <a href={homeHref}>
            <Brand />
          </a>
          <div>
            <ThemeToggle locale={locale} account={!!session} />
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
          <RouteLoading locale={locale} />
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
                <FavoriteButton
                  key={`${token}-${session?.user?.email ?? "guest"}`}
                  token={token!}
                  authenticated={!!session}
                  locale={locale}
                  onError={() => notify("favoriteError")}
                  onSignIn={() => {
                    location.href =
                      homeHref +
                      "?returnTo=" +
                      encodeURIComponent(sharePath(token!, locale));
                  }}
                />
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
            <div className="public-media">
              <div className="public-map" ref={publicMapRef}>
                <RouteMap
                  locale={locale}
                  geometry={publicRoute.geometry}
                  annotations={publicRoute.annotations}
                  focusAnnotation={focusedAnnotation}
                  onVideoSeek={publicRoute.youtubeUrl ? seekVideo : undefined}
                  activeAnnotationIds={activeAnnotations}
                  endpoints={publicRoute.endpoints}
                  fitKey={token}
                  errorLabel={t.mapUnavailable}
                />
              </div>
              {publicRoute.youtubeUrl && (
                <div className="public-video">
                  <RouteVideo
                    value={publicRoute.youtubeUrl}
                    subscription={publicRoute.subscription}
                    locale={locale}
                    seek={videoSeek}
                    onTime={setPlaybackTime}
                    syncEnabled={autoVideoHighlights}
                    onSyncChange={
                      hasVideoNotes ? changeVideoHighlights : undefined
                    }
                  />
                </div>
              )}
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
          <a href={homeHref}>
            <Brand />
          </a>
          <nav
            aria-label={
              locale === "ru" ? "Настройки отображения" : "Display settings"
            }
          >
            <ThemeToggle locale={locale} account={!!session} />
            {languageButton}
          </nav>
        </header>
        <main className="signin-main">
          <div className="signin-art">
            <img
              className="signin-map"
              src="/maps/london-c3.webp"
              alt={
                locale === "ru"
                  ? "Веломаршрут вдоль Темзы в Лондоне"
                  : "Cycling route along the Thames in London"
              }
            />
            <a
              className="signin-map-credit"
              href="https://www.openstreetmap.org/copyright"
              target="_blank"
              rel="noopener noreferrer"
            >
              © OpenStreetMap contributors
            </a>
            <div>
              <span className="eyebrow">SPIDERROUTE</span>
              <h2>{t.tagline}</h2>
            </div>
          </div>
          <section className="signin-form">
            <h1>{t.signin}</h1>
            <p>{t.signinText}</p>
            {providers?.google && (
              <button
                className="button light full"
                onClick={() => startOAuth("google")}
              >
                <img src="/brand/google.png" width={20} height={20} alt="" />
                {t.google}
              </button>
            )}
            {providers?.apple && (
              <button
                className="button dark full"
                onClick={() => startOAuth("apple")}
              >
                {t.apple}
              </button>
            )}
            {!providers?.google && !providers?.apple && (
              <p className="subtle">{t.oauthSoon}</p>
            )}
            <details className="demo-access">
              <summary>{t.demo}</summary>
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
                    location.href =
                      safeShareReturn(dest) ??
                      location.pathname + location.search;
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
            </details>
          </section>
        </main>
        {notifyNode}
      </div>
    );
  const canSave = route?.geometry.every((s) => s.length >= 2);
  const selectedPoint = route?.geometry.flat().find((p) => p.id === selected);
  const shownGeometry = transformPreview || route?.geometry || [];
  const openNote = (a?: Annotation) => {
    setNoteEndTime(
      a?.videoEndSeconds !== undefined
        ? formatVideoTime(a.videoEndSeconds)
        : "",
    );
    setNotePosition(a?.position);
    setNoteTime(
      a?.videoSeconds !== undefined ? formatVideoTime(a.videoSeconds) : "",
    );
    setTimeRequired(false);
    setNoteId(a?.id);
    setNoteText(a?.text || "");
    setNoteColor(a?.color || "#3b82f6");
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
        <a href={homeHref}>
          <Brand />
        </a>
        <div>
          <ThemeToggle locale={locale} account={!!session} />
          {languageButton}
          <AccountSettings
            locale={locale}
            accountLocale={accountLocale}
            theme={theme}
            onSave={saveAccountLanguage}
          />
          <span className="user-avatar" title={session.user?.name || ""}>
            {session.user?.name?.[0]?.toUpperCase() || "S"}
          </span>
          <button
            className="icon-button"
            onClick={() => {
              if (
                !confirm(
                  locale === "ru"
                    ? "Выйти из аккаунта?"
                    : "Sign out of your account?",
                )
              )
                return;
              run(async () => {
                await save();
                await signOut({ callbackUrl: "/" });
              });
            }}
            title={t.logout}
            aria-label={t.logout}
          >
            <LogOut size={17} />
          </button>
        </div>
      </header>
      {importProgress && (
        <div
          className="import-overlay"
          role="status"
          aria-live="polite"
          aria-atomic="true"
        >
          <div className="import-card">
            <div className="import-symbol">
              <Route size={32} />
            </div>
            <span className="eyebrow">
              {locale === "ru" ? "ИМПОРТ МАРШРУТА" : "IMPORTING ROUTE"}
            </span>
            <h2>
              {
                (locale === "ru"
                  ? {
                      reading: "Читаем файл",
                      importing: "Обрабатываем маршрут",
                      preparing: "Открываем карту",
                    }
                  : {
                      reading: "Reading your file",
                      importing: "Processing your route",
                      preparing: "Opening the map",
                    })[importProgress.stage]
              }
            </h2>
            <p className="import-filename">{importProgress.filename}</p>
            <div className="import-track" aria-hidden="true">
              <span />
            </div>
            <div className="import-steps" aria-hidden="true">
              {(locale === "ru"
                ? ["Файл", "Маршрут", "Карта"]
                : ["File", "Route", "Map"]
              ).map((label, index) => (
                <span
                  key={label}
                  className={
                    index <=
                    ["reading", "importing", "preparing"].indexOf(
                      importProgress.stage,
                    )
                      ? "active"
                      : ""
                  }
                >
                  {label}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}
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
            <button
              className="button light full overview-launch"
              aria-pressed={overviewOpen}
              disabled={!routes.length}
              onClick={() => {
                setOverviewOpen(!overviewOpen);
                setMobileNav(false);
              }}
            >
              <Route size={17} />
              {locale === "ru"
                ? "Маршруты на одной карте"
                : "View routes together"}
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
          <div className="library-sort">
            <label htmlFor="library-sort">
              {locale === "ru" ? "Сортировка" : "Sort by"}
            </label>
            <select
              id="library-sort"
              value={sorts[tab]}
              onChange={(e) =>
                setSorts({ ...sorts, [tab]: e.target.value as LibrarySort })
              }
            >
              {[
                [
                  "date-desc",
                  locale === "ru" ? "Сначала обновлённые" : "Recently updated",
                ],
                [
                  "date-asc",
                  locale === "ru"
                    ? "Давно обновлённые"
                    : "Oldest updates first",
                ],
                [
                  "distance-asc",
                  locale === "ru" ? "Сначала короткие" : "Shortest first",
                ],
                [
                  "distance-desc",
                  locale === "ru" ? "Сначала длинные" : "Longest first",
                ],
                ["name-asc", locale === "ru" ? "Название: А–Я" : "Name: A–Z"],
                ["name-desc", locale === "ru" ? "Название: Я–А" : "Name: Z–A"],
              ].map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>
          <div className="route-list">
            {libraryLoaded &&
              !(tab === "routes" ? routes : favorites).length && (
                <p className="library-empty">
                  {tab === "routes"
                    ? locale === "ru"
                      ? "Пока нет маршрутов. Загрузите трек или нарисуйте маршрут."
                      : "No routes yet. Upload a track or draw a route."
                    : locale === "ru"
                      ? "Пока нет избранного. Нажмите на сердечко на странице общего маршрута."
                      : "No favorites yet. Tap the heart on a shared route to add it here."}
                </p>
              )}
            {tab === "routes"
              ? sortLibrary(routes, sorts.routes, locale).map((r) => (
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
                      <span className="card-meta">
                        <b>
                          {(r.stats.distance / 1000).toFixed(1)}{" "}
                          {locale === "ru" ? "км" : "km"}
                        </b>
                        <time
                          dateTime={r.updatedAt}
                          title={
                            (locale === "ru" ? "Обновлён: " : "Updated: ") +
                            libraryDate(r.updatedAt, locale)
                          }
                        >
                          {libraryDate(r.updatedAt, locale)}
                        </time>
                      </span>
                    </div>
                    <ChevronRight size={15} />
                  </button>
                ))
              : sortLibrary(favorites, sorts.favorites, locale).map((f) => (
                  <div key={f.id} className="favorite-row">
                    {f.available ? (
                      <a href={sharePath(f.token, locale)}>
                        <Heart size={17} />
                        <div className="favorite-info">
                          <strong>{f.title}</strong>
                          <span className="card-meta">
                            <b>
                              {(f.stats.distance / 1000).toFixed(1)}{" "}
                              {locale === "ru" ? "км" : "km"}
                            </b>
                            <time
                              dateTime={f.updatedAt}
                              title={
                                (locale === "ru" ? "Обновлён: " : "Updated: ") +
                                libraryDate(f.updatedAt, locale)
                              }
                            >
                              {libraryDate(f.updatedAt, locale)}
                            </time>
                          </span>
                        </div>
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
        <main
          className="editor"
          aria-busy={!!importProgress || routeLoad?.status === "loading"}
        >
          {routeLoad?.status === "loading" ? (
            <RouteLoading locale={locale} />
          ) : routeLoad?.status === "error" ? (
            <div className="center-state" role="alert">
              <CircleAlert size={36} />
              <h2>
                {locale === "ru"
                  ? "Не удалось загрузить маршрут"
                  : "Could not load the route"}
              </h2>
              <p>
                {locale === "ru"
                  ? "Проверьте соединение и доступ к маршруту."
                  : "Check your connection and access to this route."}
              </p>
              <button
                className="button coral"
                onClick={() => openRoute(routeLoad.id)}
              >
                {locale === "ru" ? "Попробовать снова" : "Try again"}
              </button>
            </div>
          ) : overviewOpen ? (
            <RoutesOverview
              routes={routes}
              locale={locale}
              onClose={() => setOverviewOpen(false)}
              onOpen={openRoute}
            />
          ) : !route ? (
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
                    onFocus={() => {
                      titleEditingRef.current = true;
                      titleBeforeEdit.current = route.title;
                      setTitleEditing(true);
                    }}
                    onBlur={() => {
                      titleEditingRef.current = false;
                      if (!route.title.trim())
                        update({ ...route, title: titleBeforeEdit.current });
                      setTitleEditing(false);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") e.currentTarget.blur();
                    }}
                    value={route.title}
                    maxLength={120}
                    onChange={(e) =>
                      update({ ...route, title: e.target.value })
                    }
                  />
                </div>
                <div className="action-row">
                  {route.id !== "new" && downloadMenu}
                  {route.id !== "new" && (
                    <button className="button coral small" onClick={startShare}>
                      <Share2 size={16} />
                      {t.share}
                    </button>
                  )}
                  {route.id !== "new" && (
                    <>
                      <span
                        className="autosave-indicator"
                        role="status"
                        aria-label={
                          autoSaving
                            ? locale === "ru"
                              ? "Сохранение…"
                              : "Saving…"
                            : undefined
                        }
                      >
                        {autoSaving && (
                          <LoaderCircle size={16} className="share-spinner" />
                        )}
                      </span>
                      <details
                        className="route-actions-menu"
                        ref={routeMenuRef}
                      >
                        <summary
                          className="button light small"
                          aria-label={
                            locale === "ru"
                              ? "Действия с маршрутом"
                              : "Route actions"
                          }
                        >
                          <MoreHorizontal size={20} />
                        </summary>
                        <div className="route-actions-popover">
                          {saveFailed && (
                            <button onClick={() => run(() => save())}>
                              {locale === "ru"
                                ? "Повторить сохранение"
                                : "Retry saving"}
                            </button>
                          )}
                          <button
                            className="danger-link"
                            disabled={busy || autoSaving}
                            onClick={() => {
                              if (confirm(t.deleteConfirm))
                                run(async () => {
                                  await api("routes/" + route.id, "DELETE");
                                  setRoute(null);
                                  setRouteUrl();
                                  setDirty(false);
                                  await refresh();
                                });
                            }}
                          >
                            <Trash2 size={14} />
                            {t.delete}
                          </button>
                        </div>
                      </details>
                    </>
                  )}
                </div>
              </div>
              <div
                ref={editorMapRef}
                className="editor-map route-reveal"
                key={route.id}
              >
                <RouteMap
                  locale={locale}
                  geometry={shownGeometry}
                  focusAnnotation={focusedAnnotation}
                  annotations={route.annotations}
                  selected={selected}
                  endSelected={end}
                  mode={mode}
                  onSelect={selectPoint}
                  onCoordinate={coordinate}
                  onVideoSeek={route.youtubeUrl ? seekVideo : undefined}
                  activeAnnotationIds={activeAnnotations}
                  endpoints={route.endpoints}
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
                      ].map(([m, label, Icon]) => {
                        const I = Icon as typeof Route;
                        return (
                          <button
                            disabled={!!segmentStart}
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
                      <details
                        onToggle={positionInsertionMenu}
                        ref={insertionMenu}
                        className="download-menu insert-menu"
                      >
                        <summary
                          className="tool-button"
                          aria-disabled={!!segmentStart}
                          onClick={(event) => {
                            if (segmentStart) event.preventDefault();
                          }}
                          aria-label={
                            locale === "ru" ? "Добавить метку" : "Add marker"
                          }
                        >
                          <Plus size={17} />
                          <span>
                            {locale === "ru" ? "Добавить метку" : "Add marker"}
                          </span>
                          <ChevronDown
                            className="insert-chevron"
                            size={14}
                            aria-hidden="true"
                          />
                        </summary>
                        <div>
                          {[
                            [
                              "insert",
                              false,
                              locale === "ru" ? "На маршруте" : "On the route",
                            ],
                            [
                              "insert",
                              true,
                              locale === "ru"
                                ? "На маршруте · время видео"
                                : "On the route · video time",
                            ],
                            [
                              "pin",
                              false,
                              locale === "ru"
                                ? "В любом месте"
                                : "Anywhere on the map",
                            ],
                            [
                              "pin",
                              true,
                              locale === "ru"
                                ? "В любом месте · время видео"
                                : "Anywhere · video time",
                            ],
                            [
                              "segment",
                              false,
                              locale === "ru"
                                ? "Участок маршрута"
                                : "Route segment",
                            ],
                            [
                              "segment",
                              true,
                              locale === "ru"
                                ? "Участок · время видео"
                                : "Segment · video time",
                            ],
                          ].map(([placement, timed, label]) => (
                            <button
                              key={String(label)}
                              disabled={
                                !!segmentStart || (!!timed && !route.youtubeUrl)
                              }
                              title={
                                timed && !route.youtubeUrl
                                  ? locale === "ru"
                                    ? "Сначала добавьте видео"
                                    : "Add a video first"
                                  : undefined
                              }
                              onClick={() => {
                                setSegmentStart(undefined);
                                setSelected(undefined);
                                setEnd(undefined);
                                setChoosingEnd(false);
                                setMode(placement as MapMode);
                                setInsertTimed(!!timed);
                                if (insertionMenu.current)
                                  insertionMenu.current.open = false;
                              }}
                            >
                              <span
                                className="insert-option-icons"
                                aria-hidden="true"
                              >
                                {placement === "segment" ? (
                                  <Scissors size={16} />
                                ) : placement === "insert" ? (
                                  <Route size={16} />
                                ) : (
                                  <MapPin size={16} />
                                )}
                                {timed && <Timer size={12} />}
                              </span>
                              <span>{String(label)}</span>
                            </button>
                          ))}
                        </div>
                      </details>
                    </>
                  )}
                  <div className="toolbar-divider" />
                  <button
                    className="icon-button"
                    aria-label={t.undo}
                    title={t.undo}
                    disabled={!!segmentStart || !history.length}
                    onClick={() => {
                      setFuture((f) => [route, ...f]);
                      setRoute({
                        ...history.at(-1)!,
                        revision: route.revision,
                      });
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
                    disabled={!!segmentStart || !future.length}
                    onClick={() => {
                      setHistory((h) => [...h, route]);
                      setRoute({ ...future[0], revision: route.revision });
                      setFuture((f) => f.slice(1));
                      setDirty(true);
                    }}
                  >
                    <Redo2 size={17} />
                  </button>
                </div>
                {mode !== "view" && mode !== "draw" && (
                  <div className="map-hint">
                    {mode === "segment"
                      ? locale === "ru"
                        ? segmentStart
                          ? "Выберите конец участка на том же маршруте."
                          : "Выберите начало участка на маршруте."
                        : segmentStart
                          ? "Choose the end on the same route section."
                          : "Choose the segment start on the route."
                      : choosingEnd
                        ? t.range
                        : mode === "insert"
                          ? locale === "ru"
                            ? "Нажмите на маршрут, чтобы поставить метку."
                            : "Click the route to place a marker."
                          : mode === "pin"
                            ? locale === "ru"
                              ? "Нажмите на карту, чтобы поставить метку."
                              : "Click anywhere on the map to place a marker."
                            : t.editHelp}
                    {mode === "segment" && (
                      <button
                        className="segment-cancel"
                        onClick={() => {
                          setSegmentStart(undefined);
                          setSelected(undefined);
                          setEnd(undefined);
                          setMode("view");
                        }}
                      >
                        {t.cancel}
                      </button>
                    )}
                  </div>
                )}
                {selectedPoint && mode !== "view" && mode !== "segment" && (
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
                        onClick={() =>
                          update({
                            ...route,
                            endpoints: {
                              ...routeEndpoints(
                                route.geometry,
                                route.endpoints,
                              )!,
                              startId: selectedPoint.id,
                            },
                          })
                        }
                      >
                        <CirclePlay size={14} />
                        {locale === "ru" ? "Сделать стартом" : "Set as start"}
                      </button>
                      <button
                        className="button light small"
                        onClick={() =>
                          update({
                            ...route,
                            endpoints: {
                              ...routeEndpoints(
                                route.geometry,
                                route.endpoints,
                              )!,
                              endId: selectedPoint.id,
                            },
                          })
                        }
                      >
                        <Flag size={14} />
                        {locale === "ru" ? "Сделать финишем" : "Set as finish"}
                      </button>
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
                    [t.segments, route.stats.segments],
                    [
                      t.ascent,
                      route.stats.ascent === null
                        ? "—"
                        : Math.round(route.stats.ascent) + " " + t.meters,
                    ],
                  ].map(([label, value]) => (
                    <div key={label}>
                      <div className="stat-label">
                        <span>{label}</span>
                        {label === t.ascent && (
                          <details className="stat-help">
                            <summary
                              aria-label={
                                locale === "ru"
                                  ? "Что такое набор высоты?"
                                  : "What is elevation gain?"
                              }
                            >
                              <CircleHelp size={15} aria-hidden="true" />
                            </summary>
                            <p>
                              {locale === "ru"
                                ? "Сумма всех подъёмов за маршрут по данным трека. Например, два подъёма по 50 м дают набор высоты 100 м."
                                : "The sum of all climbs along the route, based on the track’s elevation data. Two 50 m climbs add up to 100 m of elevation gain."}
                            </p>
                          </details>
                        )}
                      </div>
                      <strong>{value}</strong>
                    </div>
                  ))}
                </div>
                <RouteVideo
                  key={route.id}
                  value={route.youtubeUrl}
                  subscription={route.subscription}
                  onSubscriptionChange={(subscription) =>
                    update({ ...route, subscription })
                  }
                  rememberedChannel={youtubeChannel}
                  onRememberChannel={async (id) => {
                    await api("me", "PATCH", { youtubeChannel: id });
                    setYoutubeChannel(id);
                  }}
                  seek={videoSeek}
                  onTime={setPlaybackTime}
                  syncEnabled={autoVideoHighlights}
                  onSyncChange={
                    hasVideoNotes ? changeVideoHighlights : undefined
                  }
                  locale={locale}
                  onChange={(url) => {
                    setVideoSeek(null);
                    update({
                      ...route,
                      youtubeUrl: url,
                      subscription: { enabled: true, channelId: null },
                    });
                  }}
                />
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
                      onEdit={openNote}
                      onSelect={(a) => {
                        setFocusedAnnotation({ id: a.id });
                        editorMapRef.current?.scrollIntoView({
                          behavior: "smooth",
                          block: "center",
                        });
                      }}
                    />
                  ) : (
                    <p className="subtle">{t.noNotes}</p>
                  )}
                </section>
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
                <h2>{t.share}</h2>
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
            <details className="share-help">
              <summary>
                <CircleHelp size={16} />
                {locale === "ru"
                  ? "Скрыть начало и конец"
                  : "Hide start and finish"}
              </summary>
              <p>{t.privacyHelp}</p>
            </details>
            <div className="privacy-controls">
              {[
                ["privacyStart", locale === "ru" ? "Начало" : "Start"],
                ["privacyEnd", locale === "ru" ? "Конец" : "Finish"],
              ].map(([key, label]) => (
                <label key={key}>
                  <span className="privacy-field-label">
                    <i
                      className={
                        key === "privacyStart"
                          ? "privacy-dot start"
                          : "privacy-dot finish"
                      }
                    />
                    {label}
                  </span>
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
            <div className="share-preview-heading">
              <span>{locale === "ru" ? "Предпросмотр" : "Preview"}</span>
              <button
                className="button light small"
                disabled={busy}
                onClick={() => run(previewShare)}
              >
                <Redo2 size={14} />
                {locale === "ru" ? "Обновить" : "Refresh"}
              </button>
            </div>
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
            <div className="share-preview-caption">
              <span>
                {preview
                  ? `${(preview.stats.distance / 1000).toFixed(2)} ${locale === "ru" ? "км" : "km"}`
                  : locale === "ru"
                    ? "Загрузка…"
                    : "Loading…"}
              </span>
              <details className="share-help map-help">
                <summary>
                  <CircleHelp size={16} />
                  {locale === "ru" ? "Что видно на карте?" : "Map key"}
                </summary>
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
                <p>{t.ownerPreview}</p>
              </details>
            </div>
            <details className="share-help sharing-help">
              <summary>
                <CircleHelp size={16} />
                {locale === "ru"
                  ? "Доступно всем, у кого есть ссылка"
                  : "Anyone with the link can view"}
              </summary>
              <p>{t.publishWarning}</p>
              {route.shared && <p>{t.liveShare}</p>}
            </details>
            {route.shared && (
              <div className="share-link share-link-reveal">
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
                  <Check size={16} aria-hidden="true" />
                  {t.apply}
                </button>
              ) : !route.shared ? (
                <button
                  className={
                    "button coral full " +
                    (publishing ? "share-publishing" : "")
                  }
                  disabled={busy || !preview}
                  aria-busy={publishing}
                  aria-label={
                    publishing
                      ? locale === "ru"
                        ? "Создаём ссылку…"
                        : "Creating link…"
                      : t.publish
                  }
                  onClick={() =>
                    run(async () => {
                      flushSync(() => setPublishing(true));
                      try {
                        await new Promise<void>((resolve) =>
                          requestAnimationFrame(() => setTimeout(resolve, 0)),
                        );
                        const result = await api(
                          "routes/" + route.id + "/share",
                          "POST",
                          {
                            confirm: true,
                            revision: route.revision,
                          },
                        );
                        setRoute({
                          ...route,
                          shared: true,
                          shareToken: result.token,
                        });
                        void refresh().catch(() => notify("error"));
                      } finally {
                        setPublishing(false);
                      }
                    })
                  }
                >
                  {publishing && (
                    <LoaderCircle
                      size={18}
                      className="share-spinner"
                      aria-hidden="true"
                    />
                  )}
                  <span role="status" aria-live="polite">
                    {publishing
                      ? locale === "ru"
                        ? "Создаём ссылку…"
                        : "Creating link…"
                      : t.publish}
                  </span>
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
            {route.youtubeUrl && (
              <label>
                {locale === "ru"
                  ? end && end !== selected
                    ? "Начало в видео (м:с или ч:м:с)"
                    : "Время в видео (м:с или ч:м:с)"
                  : end && end !== selected
                    ? "Video start (m:ss or h:mm:ss)"
                    : "Video time (m:ss or h:mm:ss)"}
                <input
                  value={noteTime}
                  placeholder="1:30"
                  maxLength={10}
                  onChange={(e) => setNoteTime(e.target.value)}
                  aria-invalid={
                    (timeRequired || !!noteTime) &&
                    parseVideoTime(noteTime) === undefined
                  }
                />
                {(timeRequired || !!noteTime) &&
                  parseVideoTime(noteTime) === undefined && (
                    <span role="alert">
                      {locale === "ru"
                        ? "Укажите время, например 1:30 (до 24 часов)."
                        : "Enter a time such as 1:30 (up to 24 hours)."}
                    </span>
                  )}
              </label>
            )}
            {route.youtubeUrl && end && end !== selected && (
              <label>
                {locale === "ru"
                  ? "Конец в видео (м:с или ч:м:с)"
                  : "Video end (m:ss or h:mm:ss)"}
                <input
                  value={noteEndTime}
                  placeholder="2:30"
                  maxLength={10}
                  onChange={(e) => setNoteEndTime(e.target.value)}
                  aria-invalid={
                    !validVideoTimes(noteTime, noteEndTime, timeRequired, true)
                  }
                />
                {!validVideoTimes(
                  noteTime,
                  noteEndTime,
                  timeRequired,
                  true,
                ) && (
                  <span role="alert">
                    {locale === "ru"
                      ? "Укажите начало и конец. Конец должен быть позже начала."
                      : "Enter a start and end time. The end must be later than the start."}
                  </span>
                )}
              </label>
            )}
            <label className="color-field">
              {t.color}
              <input
                type="color"
                value={noteColor}
                onChange={(e) => setNoteColor(e.target.value)}
              />
            </label>
            <div className="color-presets" role="group" aria-label={t.color}>
              {[
                "#3b82f6",
                "#06b6d4",
                "#22c55e",
                "#a855f7",
                "#ec4899",
                "#f59e0b",
              ].map((color) => (
                <button
                  key={color}
                  type="button"
                  aria-label={`${t.color} ${color}`}
                  aria-pressed={noteColor === color}
                  style={{ backgroundColor: color }}
                  onClick={() => setNoteColor(color)}
                />
              ))}
            </div>
            <button
              className="button dark full"
              disabled={
                !selected ||
                !validNoteText(noteText) ||
                !validVideoTimes(
                  noteTime,
                  noteEndTime,
                  timeRequired,
                  !!end && end !== selected,
                )
              }
              onClick={() => {
                if (
                  !selected ||
                  !validNoteText(noteText) ||
                  !validVideoTimes(
                    noteTime,
                    noteEndTime,
                    timeRequired,
                    !!end && end !== selected,
                  )
                )
                  return;
                const a = {
                  id: noteId || uid(),
                  startId: selected!,
                  endId: end || selected!,
                  text: noteText.trim(),
                  color: noteColor,
                  ...(notePosition ? { position: notePosition } : {}),
                  ...(route.youtubeUrl && noteTime
                    ? {
                        videoSeconds: parseVideoTime(noteTime),
                        ...(end && end !== selected && noteEndTime
                          ? { videoEndSeconds: parseVideoTime(noteEndTime) }
                          : {}),
                      }
                    : {}),
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
              <Check size={16} aria-hidden="true" />
              {locale === "ru" ? "Готово" : "Done"}
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
