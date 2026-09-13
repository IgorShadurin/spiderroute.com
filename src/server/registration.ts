import { resolveTheme } from "../lib/theme";
import { randomUUID } from "node:crypto";
import { sql } from "./db";
import { resolveLocale } from "../lib/language";
export function welcomeEmail(value: unknown) {
  const locale = resolveLocale(value);
  return {
    subject:
      locale === "ru"
        ? "Добро пожаловать в SpiderRoute"
        : "Welcome to SpiderRoute",
    body:
      locale === "ru"
        ? "Добро пожаловать в SpiderRoute!\n\nЗагрузите GPS-трек, отредактируйте маршрут, добавьте заметки и поделитесь картой с друзьями.\n\nОткрыть редактор: https://app.spiderroute.com/\n\nЯзык интерфейса и писем можно изменить в настройках аккаунта."
        : "Welcome to SpiderRoute!\n\nUpload a GPS track, edit your route, add notes and share a map with friends.\n\nOpen the editor: https://app.spiderroute.com/\n\nYou can change the language for the app and emails in account settings.",
  };
}
export function registerOAuthUser(
  email: string,
  name: string,
  provider: string,
  subject: string,
  preference: unknown,
  themePreference?: unknown,
) {
  const id = randomUUID(),
    now = new Date().toISOString(),
    locale = resolveLocale(preference),
    mail = welcomeEmail(locale);
  sql.transaction(() => {
    sql
      .prepare(
        "INSERT INTO users(id,email,name,locale,created_at,theme) VALUES(?,?,?,?,?,?)",
      )
      .run(
        id,
        email.toLowerCase(),
        name,
        locale,
        now,
        resolveTheme(themePreference),
      );
    sql
      .prepare("INSERT INTO identities VALUES(?,?,?)")
      .run(provider, subject, id);
    sql
      .prepare(
        "INSERT INTO outbox(id,recipient,subject,body,created_at) VALUES(?,?,?,?,?)",
      )
      .run("welcome:" + id, email.toLowerCase(), mail.subject, mail.body, now);
  })();
  return id;
}
