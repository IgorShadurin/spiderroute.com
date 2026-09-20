type RegistrationNotice = {
  id: string;
  email: string;
  name: string;
  provider: string;
  createdAt: string;
  totalUsers: number;
};

export async function notifyTelegramRegistration(user: RegistrationNotice) {
  const token = process.env.TELEGRAM_BOT_TOKEN?.trim();
  const chatId = process.env.TELEGRAM_CHAT_ID?.trim();
  if (
    !token ||
    !chatId ||
    process.env.TELEGRAM_REGISTRATION_NOTIFICATIONS_ENABLED === "false"
  )
    return;

  const field = (value: string) =>
    value.replace(/[\r\n\t]/g, " ").slice(0, 300);
  const text = [
    `[spiderroute.com] 👤 New User Registration${process.env.NODE_ENV === "production" ? "" : " (local)"}`,
    "",
    `🆔 User ID: ${user.id}`,
    `📧 Email: ${field(user.email)}`,
    `🙍 Name: ${field(user.name)}`,
    `🔑 Provider: ${field(user.provider)}`,
    `🕒 Timestamp: ${user.createdAt}`,
    `👥 Total registered users: ${user.totalUsers}`,
  ].join("\n");

  try {
    const response = await fetch(
      `https://api.telegram.org/bot${token}/sendMessage`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          text,
          link_preview_options: { is_disabled: true },
        }),
        cache: "no-store",
        signal: AbortSignal.timeout(5000),
      },
    );
    const result = await response.json();
    if (!response.ok || result.ok !== true) {
      console.error("[telegram-registration] Delivery failed", response.status);
    }
  } catch {
    // A Telegram outage must not reject an already-created account. Never log
    // fetch errors: their request URL can contain the bot token.
    console.error("[telegram-registration] Delivery failed or timed out");
  }
}
