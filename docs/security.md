# Security and privacy

[Back to SpiderRoute](../README.md)

Routes belong to one account and are private until an explicit share action. Owner APIs check account ownership, mutation origins and rate limits. OAuth identities are not linked automatically by email. Google and Apple appear only when their independent credentials are configured.

Sharing suggests 500 m zones around the original endpoints. All intersecting geometry and hidden notes are removed from a separate public snapshot. Public statistics use only visible geometry. Timestamps, speed, elevation, source filenames and original endpoint coordinates are omitted. User-authored titles and notes may themselves disclose information; preview before publishing. Endpoint hiding cannot guarantee anonymity.

New public links use 16-character codes with 96 bits of cryptographic randomness: `https://spiderroute.com/<code>/en` (or `/ru`). Repeated sharing and route edits keep the same code. Existing 32-character links remain aliases until revoked. Revocation removes every active alias; explicitly sharing again creates a new code, and revoked codes are never reused. Each read verifies an indexed active-share record before using a bounded payload cache; no shared-route response can be publicly cached. Saved edits regenerate the snapshot atomically. Revocation stops future reads but cannot recall downloaded data or independent clones. Favorites reference the original route; clones contain only the published snapshot and belong to the new owner.

Uploads are limited to 25 MB/200,000 points. XML external entities/DTDs are rejected. No arbitrary source URLs are fetched. Route files, databases, private screenshots and credentials must remain outside source control and build contexts.
