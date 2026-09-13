"use client";
import { useEffect, useRef, useState } from "react";
import { ExternalLink } from "lucide-react";
import { channelId, type Subscription } from "@/lib/youtube-channel";
import { useTheme } from "./ThemeProvider";
type SubscribeAPI = {
  render: (container: HTMLElement, options: Record<string, string>) => void;
};
let platform: Promise<SubscribeAPI> | undefined;
function loadPlatform() {
  const w = window as Window & { gapi?: { ytsubscribe?: SubscribeAPI } };
  if (w.gapi?.ytsubscribe) return Promise.resolve(w.gapi.ytsubscribe);
  if (!platform)
    platform = new Promise<SubscribeAPI>((resolve, reject) => {
      const script = document.createElement("script");
      script.src = "https://apis.google.com/js/platform.js";
      script.async = true;
      let elapsed = 0;
      const timer = setInterval(() => {
        if (w.gapi?.ytsubscribe) {
          clearInterval(timer);
          resolve(w.gapi.ytsubscribe);
        } else if ((elapsed += 100) >= 15000) {
          clearInterval(timer);
          platform = undefined;
          reject(Error("unavailable"));
        }
      }, 100);
      script.onerror = () => {
        clearInterval(timer);
        platform = undefined;
        script.remove();
        reject(Error("unavailable"));
      };
      document.head.append(script);
    });
  return platform;
}
function SubscribeWidget({ id, locale }: { id: string; locale: string }) {
  const host = useRef<HTMLDivElement>(null);
  const [failed, setFailed] = useState(false);
  const { theme } = useTheme();
  useEffect(() => {
    let cancelled = false;
    setFailed(false);
    const container = host.current!;
    loadPlatform()
      .then((api) => {
        if (cancelled) return;
        const child = document.createElement("div");
        container.append(child);
        api.render(child, {
          channelid: id,
          layout: "full",
          count: "hidden",
          theme: theme === "dark" ? "dark" : "default",
        });
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
      container.replaceChildren();
    };
  }, [id, theme]);
  return (
    <div className="youtube-subscribe-widget">
      <p className="subscribe-heading">
        {locale === "ru" ? "Подписаться на канал" : "Subscribe to the channel"}
      </p>
      <div ref={host} hidden={failed} />
      {
        <a
          className="button light small subscription-link"
          href={"https://www.youtube.com/channel/" + id + "?sub_confirmation=1"}
          target="_blank"
          rel="noopener noreferrer"
        >
          <ExternalLink size={16} />
          {locale === "ru" ? "Подписаться на YouTube" : "Subscribe on YouTube"}
        </a>
      }
    </div>
  );
}
export function YouTubeSubscribe({
  videoId,
  config,
  locale,
  onChange,
  rememberedChannel,
  onRemember,
}: {
  videoId: string;
  config?: Subscription;
  locale: string;
  onChange?: (value: Subscription) => void;
  rememberedChannel?: string | null;
  onRemember?: (id: string) => Promise<void>;
}) {
  const value = config ?? { enabled: true, channelId: null };
  const current = useRef({ value, onChange, rememberedChannel });
  current.current = { value, onChange, rememberedChannel };
  const generation = useRef(0);
  const [draft, setDraft] = useState(value.channelId ?? "");
  const [status, setStatus] = useState("");
  const [error, setError] = useState(false);
  const [resolvedChannel, setResolvedChannel] = useState<string | null>(null);
  useEffect(() => setDraft(value.channelId ?? ""), [value.channelId]);
  useEffect(() => {
    const version = ++generation.current;
    setResolvedChannel(null);
    if (value.channelId || (!onChange && !value.enabled)) return;
    setStatus("loading");
    const controller = new AbortController();
    fetch("/api/youtube/channel?video=" + encodeURIComponent(videoId), {
      signal: controller.signal,
    })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .catch(() => ({ channelId: null }))
      .then((data) => {
        if (controller.signal.aborted || version !== generation.current) return;
        let detected: string | null = null;
        try {
          detected = channelId(data.channelId);
        } catch {}
        const fallback = current.current.rememberedChannel;
        setStatus(detected ? "detected" : fallback ? "remembered" : "manual");
        const id = detected ?? (onChange ? fallback : null);
        setResolvedChannel(id ?? null);
        if (id)
          current.current.onChange?.({
            ...current.current.value,
            channelId: id,
          });
      });
    return () => controller.abort();
  }, [videoId, !!onChange, value.channelId, value.enabled]);
  const saveChannel = async () => {
    try {
      const id = channelId(draft);
      if (!id) throw Error();
      ++generation.current;
      setError(false);
      onChange?.({ ...current.current.value, channelId: id });
      await onRemember?.(id);
      setStatus("saved");
    } catch {
      setError(true);
    }
  };
  return (
    <div className="youtube-subscribe">
      {onChange && (
        <>
          <label className="video-sync-option">
            <input
              type="checkbox"
              checked={value.enabled}
              onChange={(e) =>
                onChange({ ...value, enabled: e.target.checked })
              }
            />
            {locale === "ru"
              ? "Показывать кнопку подписки на канал"
              : "Show channel subscription button"}
          </label>
          {status === "loading" && (
            <small role="status">
              {locale === "ru" ? "Определяем канал…" : "Finding the channel…"}
            </small>
          )}
          {status === "remembered" && (
            <small>
              {locale === "ru"
                ? "Использован сохранённый канал. Проверьте, что это автор видео."
                : "Using your saved channel. Check that it belongs to this video."}
            </small>
          )}
          <details
            className="subscription-channel"
            open={!value.channelId || undefined}
          >
            <summary>
              {locale === "ru" ? "Канал YouTube" : "YouTube channel"}
            </summary>
            <div className="video-input">
              <input
                aria-label={
                  locale === "ru" ? "ID канала YouTube" : "YouTube channel ID"
                }
                placeholder="UC… / https://www.youtube.com/channel/UC…"
                maxLength={256}
                value={draft}
                onChange={(e) => {
                  ++generation.current;
                  setDraft(e.target.value);
                  setError(false);
                  setStatus("");
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    void saveChannel();
                  }
                }}
              />
              <button
                className="button light small"
                onClick={() => void saveChannel()}
              >
                {locale === "ru" ? "Применить" : "Apply"}
              </button>
            </div>
            <small>
              {locale === "ru"
                ? "Если канал не определился, укажите ID из настроек YouTube. Сохраним его для следующих видео."
                : "If detection fails, enter the channel ID from YouTube settings. We’ll remember it for future videos."}
            </small>
            {status === "saved" && (
              <small role="status">
                {locale === "ru" ? "Канал сохранён." : "Channel saved."}
              </small>
            )}
            {error && (
              <p role="alert">
                {locale === "ru"
                  ? "Проверьте ID канала (UC…) и попробуйте ещё раз."
                  : "Check the channel ID (UC…) and try again."}
              </p>
            )}
          </details>
        </>
      )}
      {value.enabled && (value.channelId || resolvedChannel) && (
        <SubscribeWidget
          id={(value.channelId || resolvedChannel)!}
          locale={locale}
        />
      )}
    </div>
  );
}
