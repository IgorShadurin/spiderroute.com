# SpiderRoute

A private-by-default route library and editor. Next.js, SQLite, and MapLibre. Import GPX, KML, GeoJSON and CSV; edit points and sections; annotate; share privacy-filtered routes; favorite or independently clone shared routes.

## Run locally

Node.js 24 is required. Run `npm ci`, copy `.env.example` to `.env.local`, set a randomly generated `NEXTAUTH_SECRET`, then `npm run dev`. The app is at http://localhost:3210/workspace. English/Russian landing pages are served by hostname; `/?lang=ru` previews Russian locally.

Create an invited demo account with `npm run demo:create -- email@example.test 'Explorer'`. The command generates a password and prints it once. Save it privately; never commit it. Public email/password registration is intentionally unavailable.

## Security model

Routes belong to one account and are private until an explicit share action. Owner APIs check account ownership, mutation origins and rate limits. OAuth identities are not linked automatically by email. Google and Apple appear only when their independent credentials are configured.

Sharing suggests 500 m zones around the original endpoints. All intersecting geometry and hidden notes are removed from a separate public snapshot. Public statistics use only visible geometry. Timestamps, speed, elevation, source filenames and original endpoint coordinates are omitted. User-authored titles and notes may themselves disclose information; preview before publishing. Endpoint hiding cannot guarantee anonymity.

Public tokens use 192 bits of randomness. Each read verifies an indexed active-share record before using a bounded payload cache; no shared-route response can be publicly cached. Saved edits regenerate the snapshot atomically. Revocation stops future reads but cannot recall downloaded data or independent clones. Favorites reference the original route; clones contain only the published snapshot and belong to the new owner.

Uploads are limited to 25 MB/200,000 points. XML external entities/DTDs are rejected. No arbitrary source URLs are fetched. Route files, databases, private screenshots and credentials must remain outside source control and build contexts.

## Production on Coolify

Use the repository Dockerfile and one application instance, port 3000. Attach a persistent writable directory volume to `/data`, owned by UID 1000. It contains SQLite and its WAL/SHM files; mount the directory, never just the database file. Do not scale this SQLite writer across hosts.

Configure `NEXTAUTH_URL=https://app.spiderroute.com`, a strong `NEXTAUTH_SECRET`, and the enabled OAuth/Postal variables. Attach `https://spiderroute.com`, `https://www.spiderroute.com`, `https://ru.spiderroute.com` and `https://app.spiderroute.com`. DNS web records point to the application server; Cloudflare uses Full (strict) with a valid origin certificate and HTTP-to-HTTPS redirects. The apex serves the landing and app host redirects `/` to `/workspace`.

Health endpoint: `/api/health`. Exclude authenticated and `/api/public/*` responses from Cloudflare cache rules. Never use Cache Everything on the app host. Build static assets may be cached normally. MapLibre workers are copied from the installed package by `prebuild`; the Docker build and CI verify that native SQLite loads inside the production image.

On the current shared proxy, Certbot handles the four SpiderRoute hostnames through a scoped HTTP challenge router. Its deploy hook atomically updates the Traefik certificate files; `certbot.timer` renews them. Keep this hook and the challenge router when changing Coolify labels, and avoid assigning a second certificate resolver to the same hostnames. Test renewal with `certbot renew --cert-name spiderroute.com --dry-run`.

Production admin commands inside the app container:

```sh
node scripts/admin.mjs demo email@example.test 'Explorer'
node scripts/admin.mjs backup
node scripts/admin.mjs mail-test controlled-mailbox@example.test
```

A backup is produced using SQLite's consistent backup API. Route geometry, original geometry, annotations and published snapshots are all inside SQLite. The production process runs a consistent daily backup and prunes backups older than 30 days. Configure encrypted off-host copying separately; local backups do not protect against server loss. To restore: stop the application, preserve the failed database for diagnosis, restore the selected backup to `/data/spiderroute.sqlite`, remove only stale WAL/SHM files while stopped, restore ownership, then start and verify health and account/route access. Validate this on a temporary database before replacing production. Back up before releases; code rollback does not undo database migrations.

## Postal

Set `POSTAL_API_URL`, `POSTAL_API_KEY`, `POSTAL_FROM_EMAIL`, and `POSTAL_WEBHOOK_PUBLIC_KEY` (PEM or base64 PEM). Use a dedicated SpiderRoute credential. Add domain-specific DKIM, one SPF policy, and an aligned return path using Postal's exact values. Preserve existing MX records. Start DMARC in monitoring mode.

Webhook: `https://app.spiderroute.com/api/postal/webhook`. The receiver checks `x-postal-signature-256` using RSA-SHA256. The outbox retries failures with backoff, records provider IDs and suppresses bounced recipients. Delivery attempts are at-least-once: a network timeout after provider acceptance can cause a repeat; a stable X-SpiderRoute-Outbox-ID header aids diagnosis. No marketing automation is included.

Verify actual delivery to a controlled mailbox and inspect SPF/DKIM/DMARC, Postal delivery status and signed webhook events. An API success alone does not prove delivery. Never expose route data in test emails.

## Map hosting

At launch the browser uses OpenStreetMap standard tiles with attribution and HTTP caching. Tile requests send the application origin, not route paths or share tokens. Public OSM tiles are best-effort, for policy-compliant interactive use only. No bulk download, offline maps, or tile load testing.

The separate-server package in [ops/tiles](ops/tiles/README.md) downloads/verifies a planet archive and pinned fonts/sprites, serves vector tiles over HTTPS, and generates styles. Nothing requires storing worldwide map data on the app server. Set `MAP_PROVIDER=self-hosted-vector` and `MAP_STYLE_URL` to switch, then restart. Route data does not change.

## Checks

- `npm test`: import/export, privacy clipping, editing, ownership, publication, conflict handling, clones and revocation.
- `npm run typecheck` and `npm run build`.
- `npx tsx scripts/check-api.ts`: against a running local server and private demo credential files; creates and deletes synthetic routes. `TEST_BASE_URL` and credential-file variables allow a bounded deployment smoke test.
- `npm run audit:public`: scan staged/tracked filenames and recognized secret patterns. Also manually inspect the staged diff and outgoing commits; automated scanning is not a substitute for review.

Do not run map load tests against OpenStreetMap. Use synthetic route fixtures and local map fixtures for automated tests. Personal GPX tracks are local/private test inputs only.
