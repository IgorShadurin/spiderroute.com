# Deployment and backups

[Back to SpiderRoute](../README.md)

The existing Coolify application is connected to the installed GitHub App for this public repository, with automatic deployment enabled for `main`. Pushes trigger the App's signed webhook; no separate repository webhook or deployment credential belongs in the source tree. After a push, confirm that Coolify's webhook-triggered deployment matches the commit, finishes successfully, and serves `/api/health` over HTTPS. Also verify that account routes survive the rollout on the persistent volume. GitHub Actions checks run separately; automatic deployment does not wait for CI, so run the required checks and review outgoing commits before pushing to `main`.

Use the repository Dockerfile and one application instance, port 3000. Attach a persistent writable directory volume to `/data`, owned by UID 1000. It contains SQLite and its WAL/SHM files; mount the directory, never just the database file. Do not scale this SQLite writer across hosts.

Configure `NEXTAUTH_URL=https://app.spiderroute.com`, a strong `NEXTAUTH_SECRET`, and the enabled OAuth/Postal variables. Attach `https://spiderroute.com`, `https://www.spiderroute.com`, `https://ru.spiderroute.com` and `https://app.spiderroute.com`. DNS web records point to the application server; Cloudflare uses Full (strict) with a valid origin certificate and HTTP-to-HTTPS redirects. The apex serves the landing page. The app host serves the workspace at `/`; legacy `/workspace` URLs redirect there. Private routes use `/r/<id>`, and shared routes use `/s/<code>/en` or `/s/<code>/ru`. Old query-style share links remain supported.

Health endpoint: `/api/health`. Exclude authenticated and `/api/public/*` responses from Cloudflare cache rules. Never use Cache Everything on the app host. Build static assets may be cached normally. MapLibre workers are copied from the installed package by `prebuild`; the Docker build and CI verify that native SQLite loads inside the production image.

On the current shared proxy, Certbot handles the four SpiderRoute hostnames through a scoped HTTP challenge router. Its deploy hook atomically updates the Traefik certificate files; `certbot.timer` renews them. Keep this hook and the challenge router when changing Coolify labels, and avoid assigning a second certificate resolver to the same hostnames. Test renewal with `certbot renew --cert-name spiderroute.com --dry-run`.

Production admin commands inside the app container:

```sh
node scripts/admin.mjs demo email@example.test 'Explorer'
node scripts/admin.mjs backup
node scripts/admin.mjs mail-test controlled-mailbox@example.test
```

A backup is produced using SQLite's consistent backup API. Route geometry, original geometry, annotations and published snapshots are all inside SQLite. The production process runs a consistent daily backup and prunes backups older than 30 days. Configure encrypted off-host copying separately; local backups do not protect against server loss. To restore: stop the application, preserve the failed database for diagnosis, restore the selected backup to `/data/spiderroute.sqlite`, remove only stale WAL/SHM files while stopped, restore ownership, then start and verify health and account/route access. Validate this on a temporary database before replacing production. Back up before releases; code rollback does not undo database migrations.

## Telegram registration alerts

Set `TELEGRAM_BOT_TOKEN` and `TELEGRAM_CHAT_ID` as runtime-only secrets in Coolify. SpiderRoute reuses TextFaker's IgorCorpBot and destination chat. `TELEGRAM_REGISTRATION_NOTIFICATIONS_ENABLED=false` disables alerts; otherwise configured credentials enable them. Local secrets belong only in ignored `.env.local`.

Each successful new OAuth registration sends the user ID, name, email, provider, timestamp, and total registered users. The count includes the new account and disabled accounts, excludes demo accounts, and reflects currently stored users at registration time. Existing-account sign-ins and rejected registrations do not send alerts. Local messages are labeled `(local)`. Delivery is attempted after the account and welcome email are committed, with a five-second timeout. Telegram failures are logged without credentials and do not block sign-in; failed messages are not retried.
