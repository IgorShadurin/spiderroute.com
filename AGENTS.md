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
