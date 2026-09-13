"use client";
import { useEffect, useRef, useState } from "react";
type Player = {
  getCurrentTime(): number;
  getPlayerState(): number;
  destroy(): void;
  getIframe(): HTMLIFrameElement;
};
type API = {
  Player: new (
    element: HTMLElement,
    options: Record<string, unknown>,
  ) => Player;
};
let loading: Promise<API> | undefined;
function loadAPI(): Promise<API> {
  const w = window as Window & {
    YT?: API;
    onYouTubeIframeAPIReady?: () => void;
  };
  if (w.YT?.Player) return Promise.resolve(w.YT);
  if (!loading)
    loading = new Promise((resolve, reject) => {
      const timeout = setTimeout(
        () => reject(new Error("YouTube unavailable")),
        15000,
      );
      const previous = w.onYouTubeIframeAPIReady;
      w.onYouTubeIframeAPIReady = () => {
        clearTimeout(timeout);
        previous?.();
        resolve(w.YT!);
      };
      const script = document.createElement("script");
      script.src = "https://www.youtube.com/iframe_api";
      script.async = true;
      script.onerror = () => {
        clearTimeout(timeout);
        loading = undefined;
        script.remove();
        reject(new Error("YouTube unavailable"));
      };
      document.head.append(script);
    });
  return loading;
}
export function YouTubePlayer({
  id,
  seek,
  onTime,
  locale,
}: {
  id: string;
  seek?: { seconds: number; endSeconds?: number; nonce: number } | null;
  onTime?: (seconds: number | null) => void;
  locale: string;
}) {
  const host = useRef<HTMLDivElement>(null),
    callback = useRef(onTime);
  callback.current = onTime;
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let cancelled = false,
      player: Player | undefined,
      timer: ReturnType<typeof setInterval> | undefined;
    callback.current?.(null);
    setFailed(false);
    const report = () => {
      if (!player) return;
      const state = player.getPlayerState();
      if (state === 0) callback.current?.(null);
      else if (state === 1 || state === 2)
        callback.current?.(player.getCurrentTime());
    };
    loadAPI()
      .then((api) => {
        if (cancelled || !host.current) return;
        const child = document.createElement("div");
        host.current.append(child);
        player = new api.Player(child, {
          host: "https://www.youtube-nocookie.com",
          videoId: id,
          playerVars: {
            playsinline: 1,
            origin: location.origin,
            ...(seek
              ? {
                  start: seek.seconds,
                  autoplay: 1,
                  ...(seek.endSeconds !== undefined
                    ? { end: seek.endSeconds }
                    : {}),
                }
              : {}),
          },
          events: {
            onReady: () => {
              if (cancelled) return;
              const frame = player!.getIframe();
              frame.title = locale === "ru" ? "Видео поездки" : "Ride video";
              frame.setAttribute(
                "referrerpolicy",
                "strict-origin-when-cross-origin",
              );
              timer = setInterval(report, 250);
            },
            onStateChange: report,
            onError: () => callback.current?.(null),
          },
        });
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
      clearInterval(timer);
      player?.destroy();
    };
  }, [id, seek?.nonce]);
  return (
    <div ref={host} className="video-player">
      {failed && (
        <p role="alert">
          {locale === "ru"
            ? "Не удалось загрузить плеер. Откройте видео на YouTube."
            : "Could not load the player. Open the video on YouTube."}
        </p>
      )}
    </div>
  );
}
