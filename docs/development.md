# Development and checks

[Back to SpiderRoute](../README.md)

The app uses Next.js, React, TypeScript, SQLite and MapLibre. Start with [local setup](../README.md#run-locally).

- `npm test`: import/export, privacy clipping, editing, ownership, publication, conflict handling, clones and revocation.
- `npm run typecheck` and `npm run build`.
- `npx tsx scripts/check-api.ts`: against a running local server and private demo credential files; creates and deletes synthetic routes. `TEST_BASE_URL` and credential-file variables allow a bounded deployment smoke test.
- `npm run audit:public`: scan staged/tracked filenames and recognized secret patterns. Also manually inspect the staged diff and outgoing commits; automated scanning is not a substitute for review.

Do not run map load tests against OpenStreetMap. Use synthetic route fixtures and local map fixtures for automated tests. Personal GPX tracks are local/private test inputs only.

## README screenshot

[The English product screenshot](images/spiderroute-en.png) is a capture of the running application, without browser chrome or developer tools. It uses the public [London cycleway example](../public/maps/README.md) and illustrative notes in an isolated local database. It contains no personal GPS recordings or account details. Preserve the visible OpenStreetMap attribution when replacing it.
