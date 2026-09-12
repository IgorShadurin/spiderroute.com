"use client";
import { createContext, useContext, useState } from "react";
import { Sun, Moon } from "lucide-react";
import { THEME_KEY, type Theme } from "@/lib/theme";
const ThemeContext = createContext<{
  theme: Theme;
  applyTheme: (theme: Theme) => void;
}>({ theme: "light", applyTheme: () => {} });
export function ThemeProvider({
  initialTheme,
  children,
}: {
  initialTheme: Theme;
  children: React.ReactNode;
}) {
  const [theme, setTheme] = useState(initialTheme);
  const applyTheme = (next: Theme) => {
    setTheme(next);
    document.documentElement.dataset.theme = next;
    try {
      localStorage.setItem(THEME_KEY, next);
    } catch {}
    const domain =
      location.hostname === "spiderroute.com" ||
      location.hostname.endsWith(".spiderroute.com")
        ? "; Domain=spiderroute.com"
        : "";
    document.cookie = `${THEME_KEY}=${next}; Path=/; Max-Age=31536000${domain}; ${location.protocol === "https:" ? "SameSite=None; Secure" : "SameSite=Lax"}`;
  };
  return (
    <ThemeContext.Provider value={{ theme, applyTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}
export const useTheme = () => useContext(ThemeContext);
export function ThemeToggle({
  locale = "en",
  account = false,
}: {
  locale?: "en" | "ru";
  account?: boolean;
}) {
  const { theme, applyTheme } = useTheme();
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(false);
  const label =
    locale === "ru"
      ? theme === "dark"
        ? "Светлая тема"
        : "Тёмная тема"
      : theme === "dark"
        ? "Light theme"
        : "Dark theme";
  return (
    <span className="theme-control">
      <button
        className="icon-button"
        title={label}
        aria-label={label}
        disabled={busy}
        onClick={async () => {
          const next = theme === "dark" ? "light" : "dark";
          setBusy(true);
          setError(false);
          try {
            if (account) {
              const response = await fetch("/api/me", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ theme: next }),
              });
              if (!response.ok) throw Error("saveFailed");
            }
            applyTheme(next);
          } catch {
            setError(true);
          } finally {
            setBusy(false);
          }
        }}
      >
        {theme === "dark" ? <Sun size={19} /> : <Moon size={19} />}
      </button>
      {error && (
        <span className="theme-error" role="alert">
          {locale === "ru"
            ? "Не удалось сохранить тему. Повторите попытку."
            : "Could not save theme. Please try again."}
        </span>
      )}
    </span>
  );
}
