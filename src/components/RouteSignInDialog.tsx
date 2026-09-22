"use client";
import { useEffect, useRef, useState } from "react";
import { signIn, useSession } from "next-auth/react";
import { X, Heart, Copy, LoaderCircle } from "lucide-react";
import { messages } from "@/lib/i18n";
import type { Locale } from "@/lib/types";
export function RouteSignInDialog({
  open,
  intent,
  locale,
  providers,
  onClose,
  onOAuth,
}: {
  open: boolean;
  intent: "favorite" | "clone";
  locale: Locale;
  providers: Record<string, unknown>;
  onClose: () => void;
  onOAuth: (provider: string) => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const { update } = useSession();
  const ru = locale === "ru";
  const t = messages[locale];
  useEffect(() => {
    if (!open) return;
    setError("");
    dialog.current?.showModal();
    heading.current?.focus({ preventScroll: true });
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
      dialog.current?.close();
    };
  }, [open]);
  return (
    <dialog
      ref={dialog}
      className="public-item-dialog route-signin-dialog"
      aria-labelledby="route-signin-title"
      onCancel={(e) => {
        e.preventDefault();
        if (!busy) onClose();
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget && !busy) {
          const r = e.currentTarget.getBoundingClientRect();
          if (
            e.clientX < r.left ||
            e.clientX > r.right ||
            e.clientY < r.top ||
            e.clientY > r.bottom
          )
            onClose();
        }
      }}
    >
      <header className="item-modal-header">
        <h2 id="route-signin-title" ref={heading} tabIndex={-1}>
          {ru ? "Войти" : "Sign in"}
        </h2>
        <button
          className="icon-button"
          aria-label={ru ? "Закрыть" : "Close"}
          onClick={onClose}
          disabled={busy}
        >
          <X size={21} />
        </button>
      </header>
      <div className="route-signin-body">
        <div className="signin-reason">
          {intent === "favorite" ? <Heart size={22} /> : <Copy size={22} />}
          <p>
            {intent === "favorite"
              ? ru
                ? "Войдите, чтобы сохранить маршрут в избранном."
                : "Sign in to keep this route in your favorites."
              : ru
                ? "Войдите, чтобы сохранить свою копию маршрута."
                : "Sign in to save your own copy of this route."}
          </p>
        </div>
        {!!providers.google && (
          <button
            className="button light full"
            disabled={busy}
            onClick={() => onOAuth("google")}
          >
            <img src="/brand/google.png" width={20} height={20} alt="" />
            {t.google}
          </button>
        )}
        {!!providers.apple && (
          <button
            className="button dark full"
            disabled={busy}
            onClick={() => onOAuth("apple")}
          >
            {t.apple}
          </button>
        )}
        {!providers.google && !providers.apple && (
          <p className="subtle">{t.oauthSoon}</p>
        )}
        {!!providers.credentials && (
          <details className="demo-access">
            <summary>{t.demo}</summary>
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                setBusy(true);
                setError("");
                const data = new FormData(e.currentTarget);
                try {
                  const result = await signIn("credentials", {
                    email: data.get("email"),
                    password: data.get("password"),
                    redirect: false,
                  });
                  if (result?.error) throw Error();
                  await update();
                } catch {
                  setError(
                    ru
                      ? "Не удалось войти. Проверьте почту и пароль."
                      : "Could not sign in. Check your email and password.",
                  );
                } finally {
                  setBusy(false);
                }
              }}
            >
              <label>
                {t.email}
                <input
                  name="email"
                  type="email"
                  autoComplete="username"
                  required
                />
              </label>
              <label>
                {t.password}
                <input
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  required
                />
              </label>
              {error && (
                <p role="alert" className="form-error">
                  {error}
                </p>
              )}
              <button className="button dark full" disabled={busy}>
                {busy ? (
                  <LoaderCircle className="loading-spinner" size={18} />
                ) : null}
                {busy ? t.loading : t.login}
              </button>
            </form>
          </details>
        )}
      </div>
    </dialog>
  );
}
