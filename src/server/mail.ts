import { createVerify } from "node:crypto";
import { sql } from "./db";
let busy = false;
export async function processOutbox() {
  if (busy || !process.env.POSTAL_API_URL || !process.env.POSTAL_API_KEY)
    return;
  busy = true;
  try {
    const rows = sql
      .prepare(
        "SELECT * FROM outbox WHERE status='pending' AND next_at<=? LIMIT 5",
      )
      .all(Date.now()) as any[];
    for (const r of rows) {
      if (
        sql
          .prepare("SELECT email FROM suppressions WHERE email=?")
          .get(r.recipient.toLowerCase())
      ) {
        sql
          .prepare("UPDATE outbox SET status='suppressed' WHERE id=?")
          .run(r.id);
        continue;
      }
      try {
        const response = await fetch(
          process.env.POSTAL_API_URL.replace(/\/$/, "") +
            "/api/v1/send/message",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "X-Server-API-Key": process.env.POSTAL_API_KEY,
            },
            body: JSON.stringify({
              to: [r.recipient],
              from:
                process.env.POSTAL_FROM_EMAIL ||
                "SpiderRoute <hello@spiderroute.com>",
              subject: r.subject,
              plain_body: r.body,
              tag: "spiderroute",
              headers: {
                "X-SpiderRoute-Outbox-ID": r.id,
              },
            }),
            signal: AbortSignal.timeout(15000),
          },
        );
        const result = await response.json();
        if (
          !response.ok ||
          result.status !== "success" ||
          typeof result.data?.message_id !== "string"
        )
          throw Error("deliveryFailed");
        sql
          .prepare(
            "UPDATE outbox SET status='sent',provider_id=?,attempts=attempts+1 WHERE id=?",
          )
          .run(String(result.data?.message_id || ""), r.id);
      } catch {
        sql
          .prepare(
            "UPDATE outbox SET attempts=attempts+1,status=?,next_at=? WHERE id=?",
          )
          .run(
            r.attempts >= 5 ? "failed" : "pending",
            Date.now() + Math.min(3600000, 30000 * 2 ** r.attempts),
            r.id,
          );
      }
    }
  } finally {
    busy = false;
  }
}
export function postalWebhook(raw: string, signature: string | null) {
  const configured = process.env.POSTAL_WEBHOOK_PUBLIC_KEY?.replace(
    /\\n/g,
    "\n",
  );
  if (!configured || !signature) return false;
  const key = configured.includes("BEGIN PUBLIC KEY")
    ? configured
    : Buffer.from(configured, "base64").toString("utf8");
  try {
    const verify = createVerify("RSA-SHA256");
    verify.update(raw);
    verify.end();
    if (!verify.verify(key, signature, "base64")) return false;
    const e = JSON.parse(raw);
    if (typeof e.uuid !== "string" || typeof e.event !== "string") return false;
    const m = e.payload?.original_message || e.payload?.message || {};
    if (e.event === "DomainDNSError") {
      if (e.payload?.domain !== "spiderroute.com") return false;
    } else if (m.tag !== "spiderroute") return false;
    sql.transaction(() => {
      sql
        .prepare("INSERT OR IGNORE INTO delivery_events VALUES(?,?,?,?)")
        .run(
          e.uuid,
          e.event,
          String(m.message_id || m.id || ""),
          new Date().toISOString(),
        );
      if (
        ["MessageBounced", "MessageDeliveryFailed"].includes(e.event) &&
        typeof m.to === "string"
      )
        sql
          .prepare("INSERT OR REPLACE INTO suppressions VALUES(?,?)")
          .run(m.to.toLowerCase(), e.event);
    })();
    return true;
  } catch {
    return false;
  }
}
