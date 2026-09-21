import { sql } from "./db";
import { sendTelegram } from "./telegram";

/** Call after a successful request has committed a new route or set. */
export async function notifyCreation(
  kind: "route" | "set",
  id: string,
  userId: string,
) {
  try {
    const table = kind === "route" ? "routes" : "item_sets";
    const item = sql
      .prepare(`SELECT title FROM ${table} WHERE id=? AND user_id=?`)
      .get(id, userId) as { title: string } | undefined;
    const user = sql
      .prepare("SELECT name,email FROM users WHERE id=?")
      .get(userId) as { name: string; email: string } | undefined;
    if (!item || !user) return;
    const count = sql.prepare(`SELECT count(*) AS n FROM ${table}`).get() as {
      n: number;
    };
    const field = (value: string) =>
      value.replace(/[\r\n\t]/g, " ").slice(0, 300);
    await sendTelegram(
      [
        `[spiderroute.com] ${kind === "route" ? "🗺 New Route" : "🧺 New Set"}${process.env.NODE_ENV === "production" ? "" : " (local)"}`,
        "",
        `Title: ${field(item.title)}`,
        `Name: ${field(user.name)}`,
        `Email: ${field(user.email)}`,
        `User ID: ${userId}`,
        `${kind === "route" ? "Route" : "Set"} ID: ${id}`,
        `Timestamp: ${new Date().toISOString()}`,
        `Total ${kind === "route" ? "routes" : "sets"}: ${count.n}`,
      ].join("\n"),
      kind === "route" ? "ROUTE_CREATION" : "SET_CREATION",
    );
  } catch {
    // Notification problems must never turn a committed creation into an error.
    console.error("[telegram] Creation notification failed");
  }
}
