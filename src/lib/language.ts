import type { Locale } from "./types";
export const LANGUAGE_KEY = "spiderroute-language";
export function validLocale(value: unknown): value is Locale {
  return value === "en" || value === "ru";
}
export function resolveLocale(value: unknown): Locale {
  return validLocale(value) ? value : "en";
}
export function rememberLanguage(locale: Locale) {
  try {
    localStorage.setItem(LANGUAGE_KEY, locale);
  } catch {
    /* Storage may be unavailable in private browsing. */
  }
  // OAuth callbacks cannot read localStorage. SameSite=None also covers Apple's POST callback.
  document.cookie = `${LANGUAGE_KEY}=${locale}; Path=/; Max-Age=31536000; ${location.protocol === "https:" ? "SameSite=None; Secure" : "SameSite=Lax"}`;
}
export function storedLanguage(): Locale {
  try {
    return resolveLocale(localStorage.getItem(LANGUAGE_KEY));
  } catch {
    return "en";
  }
}
