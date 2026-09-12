export type Theme = "light" | "dark";
export const THEME_KEY = "spiderroute-theme";
export function validTheme(value: unknown): value is Theme {
  return value === "light" || value === "dark";
}
export function resolveTheme(value: unknown): Theme {
  return validTheme(value) ? value : "dark";
}
