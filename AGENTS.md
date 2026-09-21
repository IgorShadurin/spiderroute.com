<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Local development and Google authentication

- Always run the local app with `npm run dev` on port **3210** and open `http://localhost:3210/workspace`. Do not switch ports or use `127.0.0.1` for Google sign-in; the OAuth URLs are registered for `localhost:3210`.
- Keep `NEXTAUTH_URL=http://localhost:3210` in `.env.local`. Google Cloud project `spiderroute`, OAuth client `SpiderRoute Web`, uses origin `http://localhost:3210` and redirect URI `http://localhost:3210/api/auth/callback/google` for local development.
- Local `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` belong in ignored `.env.local` only. Preserve the existing local `NEXTAUTH_SECRET`; do not overwrite `.env.local` with the example file or commit/log credentials.
- Coolify production settings are read-only when configuring local development. Do not change production variables or rotate credentials. Preserve the production OAuth origin and callback when editing localhost URLs.
- Check `/api/auth/providers` for the Google provider and its localhost callback before handing off the local app. Reuse an existing server on port 3210 when possible.

## Local Telegram notifications

- Keep `TELEGRAM_NOTIFICATIONS_ENABLED=false` in ignored `.env.local` during local testing. This disables registration, route and set creation messages without changing production settings.
- Re-enable only when requested by setting it to `true`, then restart `npm run dev` on port 3210. Keep the existing bot token, chat ID and per-event switches intact.

## UI interactions and feedback

- Use the app's shared confirmation modal for destructive actions, revoking public access, publishing, and discarding unsaved changes. Never use browser `alert`, `confirm`, or `prompt`. Keep the title short and specific, explain consequences only where useful, and label the primary action with its verb (e.g. «Удалить», «Не сохранять»). Keep icon and text together in a compact layout.
- Use non-blocking, styled toasts for brief results such as copying a link or saving successfully. Reuse `FeedbackToast` for new notification UI. Show one notification, automatically dismiss success after about 3 seconds, allow longer reading time for errors, and provide a dismiss control. Repeated actions must restart the timer. Never put transient feedback in a distant page footer or allocate an empty layout row for it.
- Keep actionable validation next to its field; do not hide persistent errors only in a disappearing toast. Use status/alert live regions appropriately and never steal focus for passive feedback. Ensure notifications remain visible and operable above dialogs.
- Match existing colors, typography, spacing, rounded corners and dark/light themes. Prefer compact icon buttons for secondary actions with accessible names and hover tooltips; do not replace clear primary actions with unexplained icons.
- Use quick, subtle 150–200 ms entry/exit transitions for dialogs and toasts, and respect reduced-motion preferences. Opening a modal must preserve the background's horizontal position and scroll position; reserve scrollbar space where needed. Support Escape, sensible initial focus, focus restoration and keyboard operation.
- Keep card actions anchored to their footer, avoid extra action rows, and show inline «ещё» / “more” only when text actually overflows. Long content belongs in an accessible detail view, without stretching every card.
- Verify interactions in the browser: short and long content, repeat actions, opening/closing, mobile sizing, both themes, and keyboard use. Check layout stability and feedback inside as well as outside a modal. Prefer established shared components over one-off interaction patterns.
