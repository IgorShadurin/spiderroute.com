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

## Sharing and progressive disclosure

- Reuse `ShareLink` for published routes, sets, and future shareable entities. Copy, open, and QR download must all use the same active public URL. Hide these controls when access is revoked; a QR must never bypass existing authorization or create a different sharing token.
- Generate branded QR codes locally with the MIT-licensed `qr-code-styling` library, loaded only when needed. Use rounded modules and finder corners, the bundled rounded `route-qr-icon.svg` SpiderRoute icon (rounding must remain in PNG/SVG exports), high error correction, a generous quiet zone, and dark ink on opaque white even in dark mode. Keep logo coverage modest and verify decoding of downloaded files. Offer PNG and SVG exports with the logo embedded and show loading/error feedback.
- Use `HelpDisclosure` for expandable helper text: a clear chevron, accessible expanded state, keyboard support, and quick 180 ms height/opacity transitions in both directions. Respect reduced motion. Keep collapsed content out of keyboard navigation.
- Prefer automatic, debounced previews over unnecessary Refresh buttons. Ignore stale responses, make loading clear, and prevent applying an outdated preview. Do not add redundant controls when feedback or automatic updates already explain the state.
- Route places are independent geographic points with stable IDs, not track annotations. Reuse `RoutePlaces` and `ShareLink`; direct links use `#place-ID`. Require a title and valid coordinates. Keep photos in persistent storage, strip image metadata during conversion, and remove replaced/deleted photos. Public places and photos must respect route revocation and hidden endpoint zones. Test these access rules whenever sharing changes.

## Uploaded images and disk usage

- Never retain uploaded originals: validate and decode on the server, strip metadata, and store a single WebP at quality 85. Limit input to 8 MB / 25 megapixels; cap item/place photos at 1600 px and avatars at 512 × 512. Unsaved previews use browser object URLs, revoked on replacement/unmount.
- Replace the database photo reference atomically, reading the current reference inside the write transaction after asynchronous decoding. Delete the replaced file after commit; delete newly written files on failure. Concurrent replacements must not leak intermediate images or restore stale references. Removing an item/place must remove its photo; deleting a container must clean its children's files. Never remove a shared source image when cloning: give each copy its own file.
- Test repeated and simultaneous uploads, invalid images, deletion during upload, and photo removal. Verify file counts and actual WebP dimensions/metadata, not only successful HTTP responses.

- Sharing URLs belong in read-only inputs with an accessible copy icon inside. Put the default PNG download and a PNG/JPEG/SVG format dropdown directly below the QR; use `ShareButton` on public pages. Place markers use the ten stored icon keys and a raised circle with a thin stem, leaving the route visible. Keep marker DOM stable across selection changes and synchronize the place hash before opening details.

- Keep modal headers rounded to match their parent surface; check sticky headers and scrollbar corners. QR placeholders use a fixed-size loading indicator, reveal only a decoded image, and keep generated assets for repeat opening. Native selects reserve 46px for an 18px chevron inset 14px from the right; split-button dropdown triggers need at least 40px width. Public route actions stay compact: Share, Favorite, then an overflow menu for downloads and copying. Guest favorites open the sign-in dialog and resume after authentication. Hide empty public-only sections.
