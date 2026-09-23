"use client";
import { useEffect, useRef, useState } from "react";
import { channelId, type Subscription } from "@/lib/youtube-channel";
import { Youtube } from "lucide-react";
function SubscribeWidget({ id, locale }: { id: string; locale: string }) {
  return (
    <div className="youtube-subscribe-widget">
      <a
        className="button light small youtube-subscribe-link"
        href={`https://www.youtube.com/channel/${id}`}
        target="_blank"
        rel="noopener noreferrer"
      >
        <Youtube size={18} aria-hidden="true" />
        {locale === "ru" ? "Подписаться на YouTube" : "Subscribe on YouTube"}
      </a>
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
  const current = useRef({ value, onChange });
  current.current = { value, onChange };
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
        setStatus(detected ? "detected" : "manual");
        setResolvedChannel(detected);
        if (detected)
          current.current.onChange?.({
            ...current.current.value,
            channelId: detected,
          });
      });
    return () => controller.abort();
  }, [videoId, !!onChange, value.channelId, value.enabled]);
  const saveChannel = async (input = draft) => {
    try {
      const id = channelId(input);
      if (!id) throw Error();
      ++generation.current;
      setError(false);
      setDraft(id);
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
            {status === "manual" && rememberedChannel && (
              <button
                type="button"
                className="text-link"
                onClick={() => void saveChannel(rememberedChannel)}
              >
                {locale === "ru"
                  ? "Использовать сохранённый канал"
                  : "Use your saved channel"}
              </button>
            )}
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
