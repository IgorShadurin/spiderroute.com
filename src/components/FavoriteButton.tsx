"use client";
import { useEffect, useRef, useState } from "react";
import { Heart } from "lucide-react";
import { messages } from "@/lib/i18n";
import type { Locale } from "@/lib/types";

export default function FavoriteButton({
  token,
  authenticated,
  locale,
  onSignIn,
  onError,
}: {
  token: string;
  authenticated: boolean;
  locale: Locale;
  onSignIn: () => void;
  onError: () => void;
}) {
  const [active, setActive] = useState(false);
  const [animated, setAnimated] = useState(false);
  const control = useRef({
    desired: false,
    saved: false,
    touched: false,
    running: false,
    cancelled: false,
  });
  const ready = useRef<Promise<void>>(Promise.resolve());
  const t = messages[locale];
  const endpoint = `/api/favorites/shared/${token}`;
  useEffect(() => {
    const state = {
      desired: false,
      saved: false,
      touched: false,
      running: false,
      cancelled: false,
    };
    control.current = state;
    setActive(false);
    if (authenticated)
      ready.current = fetch(endpoint, { cache: "no-store" })
        .then(async (response) => {
          if (!response.ok) throw Error();
          const result = await response.json();
          state.saved = result.favorite;
          if (!state.touched && !state.cancelled) {
            state.desired = result.favorite;
            setActive(result.favorite);
          }
        })
        .catch(() => {});
    return () => {
      state.cancelled = true;
    };
  }, [endpoint, authenticated]);
  const toggle = async () => {
    if (!authenticated) {
      onSignIn();
      return;
    }
    const state = control.current;
    state.touched = true;
    state.desired = !state.desired;
    setActive(state.desired);
    setAnimated(state.desired);
    if (state.running) return;
    state.running = true;
    await ready.current;
    try {
      while (!state.cancelled && state.saved !== state.desired) {
        const target = state.desired;
        const response = await fetch(endpoint, {
          method: target ? "POST" : "DELETE",
        });
        if (!response.ok) throw Error();
        state.saved = target;
      }
    } catch {
      if (!state.cancelled) {
        state.desired = state.saved;
        setActive(state.saved);
        setAnimated(false);
        onError();
      }
    } finally {
      state.running = false;
    }
  };
  return (
    <button
      type="button"
      className={`button light favorite-button${active ? " is-favorite" : ""}${animated ? " favorite-pop" : ""}`}
      aria-pressed={active}
      title={active ? t.removeFavorite : t.favorite}
      onClick={toggle}
      onAnimationEnd={() => setAnimated(false)}
    >
      <Heart size={17} aria-hidden="true" />
      <span>{active ? t.inFavorites : t.favorite}</span>
    </button>
  );
}
