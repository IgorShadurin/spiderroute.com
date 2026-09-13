"use client";
import { useState, useEffect, useRef } from "react";
import { YouTubeSubscribe } from "./YouTubeSubscribe";
import type { Subscription } from "@/lib/youtube-channel";
import { YouTubePlayer } from "./YouTubePlayer";
import { ExternalLink, Trash2, Youtube } from "lucide-react";
import { normalizeYoutube, youtubeId } from "@/lib/route-details";
export function RouteVideo({
  value,
  locale,
  onChange,
  seek,
  onTime,
  syncEnabled,
  onSyncChange,
  subscription,
  onSubscriptionChange,
  rememberedChannel,
  onRememberChannel,
}: {
  subscription?: Subscription;
  onSubscriptionChange?: (value: Subscription) => void;
  rememberedChannel?: string | null;
  onRememberChannel?: (id: string) => Promise<void>;
  onTime?: (seconds: number | null) => void;
  syncEnabled?: boolean;
  onSyncChange?: (enabled: boolean) => void;
  seek?: { seconds: number; endSeconds?: number; nonce: number } | null;
  value?: string | null;
  locale: string;
  onChange?: (url: string | null) => void;
}) {
  const player = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (seek)
      player.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [seek]);
  const [draft, setDraft] = useState(value || "");
  const [error, setError] = useState(false);
  useEffect(() => {
    setDraft(value || "");
    setError(false);
  }, [value]);
  const removeVideo = () => {
    if (!onChange) return;
    if (
      window.confirm(
        locale === "ru"
          ? "Удалить видео из маршрута? Само видео останется на YouTube."
          : "Remove this video from the route? The video will remain on YouTube.",
      )
    ) {
      setDraft("");
      setError(false);
      onChange(null);
    } else {
      setDraft(value || "");
    }
  };
  const id = value ? youtubeId(value) : null;
  if (!onChange && !id) return null;
  return (
    <section className="route-video">
      <h3>
        <Youtube size={19} />
        {locale === "ru" ? "Видео поездки" : "Ride video"}
      </h3>
      {onChange && (
        <div className="video-input">
          <input
            aria-label={locale === "ru" ? "Ссылка на YouTube" : "YouTube URL"}
            placeholder="https://www.youtube.com/watch?v=…"
            type="url"
            maxLength={2048}
            value={draft}
            aria-invalid={error}
            onChange={(e) => {
              setDraft(e.target.value);
              setError(false);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") e.currentTarget.blur();
            }}
            onBlur={() => {
              try {
                const next = normalizeYoutube(draft);
                if (!next && value) {
                  removeVideo();
                  return;
                }
                setDraft(next || "");
                if (next !== (value || null)) onChange(next);
              } catch {
                setError(true);
              }
            }}
          />
          {value && (
            <button
              className="icon-button"
              aria-label={locale === "ru" ? "Удалить видео" : "Remove video"}
              onMouseDown={(event) => event.preventDefault()}
              onClick={removeVideo}
            >
              <Trash2 size={17} />
            </button>
          )}
        </div>
      )}
      {error && (
        <p role="alert">
          {locale === "ru"
            ? "Введите корректную HTTPS-ссылку на видео YouTube."
            : "Enter a valid HTTPS YouTube video URL."}
        </p>
      )}
      {id && (
        <>
          {onSyncChange && (
            <label className="video-sync-option">
              <input
                type="checkbox"
                checked={syncEnabled ?? true}
                onChange={(event) => onSyncChange(event.target.checked)}
              />
              {locale === "ru"
                ? "Подсвечивать на карте во время видео"
                : "Highlight on the map during playback"}
            </label>
          )}
          <div ref={player}>
            <YouTubePlayer
              id={id}
              seek={seek}
              onTime={onTime}
              locale={locale}
            />
          </div>
          <a
            className="video-source-link"
            href={`https://www.youtube.com/watch?v=${id}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            <ExternalLink size={16} />
            {locale === "ru" ? "Открыть на YouTube" : "Watch on YouTube"}
          </a>
          <YouTubeSubscribe
            key={id}
            videoId={id}
            locale={locale}
            config={subscription}
            onChange={onSubscriptionChange}
            rememberedChannel={rememberedChannel}
            onRemember={onRememberChannel}
          />
        </>
      )}
    </section>
  );
}
