import type Database from "better-sqlite3";
import { validLocale } from "../lib/language";
import { validTheme } from "../lib/theme";
export function migratePreferences(db: Database.Database) {
  db.transaction(() => {
    const columns = db.prepare("PRAGMA table_info(users)").all() as {
      name: string;
    }[];
    if (!columns.some((column) => column.name === "auto_video_highlights"))
      db.exec(
        "ALTER TABLE users ADD COLUMN auto_video_highlights INTEGER NOT NULL DEFAULT 1 CHECK(auto_video_highlights IN (0,1))",
      );
    if (!columns.some((column) => column.name === "theme"))
      db.exec(
        "ALTER TABLE users ADD COLUMN theme TEXT NOT NULL DEFAULT 'light' CHECK(theme IN ('light','dark'))",
      );
  }).immediate();
}
export function updatePreferences(
  db: Database.Database,
  user: string,
  input: unknown,
) {
  if (!input || typeof input !== "object" || Array.isArray(input))
    throw Error("invalidFile");
  const value = input as Record<string, unknown>;
  const keys = Object.keys(value);
  if (
    !keys.length ||
    keys.some(
      (key) => !["locale", "theme", "autoVideoHighlights"].includes(key),
    ) ||
    ("locale" in value && !validLocale(value.locale)) ||
    ("theme" in value && !validTheme(value.theme)) ||
    ("autoVideoHighlights" in value &&
      typeof value.autoVideoHighlights !== "boolean")
  )
    throw Error("invalidFile");
  db.transaction(() => {
    if ("autoVideoHighlights" in value)
      db.prepare("UPDATE users SET auto_video_highlights=? WHERE id=?").run(
        value.autoVideoHighlights ? 1 : 0,
        user,
      );
    if ("locale" in value)
      db.prepare("UPDATE users SET locale=? WHERE id=?").run(
        value.locale,
        user,
      );
    if ("theme" in value)
      db.prepare("UPDATE users SET theme=? WHERE id=?").run(value.theme, user);
  })();
}
