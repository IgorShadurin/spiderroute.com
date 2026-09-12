# Separate worldwide map server

The launch uses OSM standard raster tiles directly. No planet data belongs on the application server. This package runs independently; switching it on does not migrate route data.

## Prepare

Use a Linux host with Docker Compose, curl, git, b3sum and approximately 300 GB available storage for active/replacement archives. This is an operational starting point, not a bandwidth capacity guarantee. Point `tiles.spiderroute.com` to this host. Ports 80/443 must reach Caddy; do not expose the PMTiles service directly.

On that server, clone this repository, run `npm ci`, and generate styles:

```sh
TILES_ORIGIN=https://tiles.spiderroute.com node ops/tiles/generate-style.mjs
```

Run `bash ops/tiles/download-assets.sh` to fetch pinned open-source basemap assets from https://github.com/protomaps/basemaps-assets. The script records its pinned commit and retains upstream license files. The layout must include `assets/fonts/{fontstack}/{range}.pbf` and `assets/sprites/v4/light.json`, `light.png`, `light@2x.json`, and `light@2x.png`.

Choose a dated world archive and its BLAKE3 checksum from https://maps.protomaps.com/builds/. Run the download script ON THIS SERVER:

```sh
bash ops/tiles/download.sh HTTPS_ARCHIVE_URL BLAKE3_HASH /srv/spiderroute-maps
```

The Compose package pins PMTiles v1.31.2. Optionally override `PMTILES_IMAGE` with its verified release digest, then:

```sh
cd ops/tiles
docker compose --env-file /secure/map-server.env -f compose.yml up -d
```

## Verify and switch

Check `/health`, `/tiles/world.json`, known tiles from several continents, `/style.json`, and every referenced sprite/font. Verify HTTPS and allowed cross-origin browser requests. Never fill missing tiles by scraping public OSM tile servers.

In SpiderRoute's Coolify environment set:

```dotenv
MAP_PROVIDER=self-hosted-vector
MAP_STYLE_URL=https://tiles.spiderroute.com/style.json
```

Restart the app. Route data and editing tools do not change. Repeat desktop/mobile checks in EN/RU. Set `MAP_STYLE_URL` to `style-ru.json` if Russian map labels are desired globally; the application language remains independent.

For updates, download and verify a replacement using the same script, restart the tile service, and verify it before removing the previous archive. To roll back, stop the tile service, swap `world.previous.pmtiles` back to `world.pmtiles`, then restart. Leave enough free space before each update. Basemap archives are reproducible downloads; back up configurations and version/checksum records.

OSM standard launch usage must honor https://operations.osmfoundation.org/policies/tiles/: visible attribution, normal browser caching, valid Referer, no offline/bulk download or automated map pan/zoom load tests. It is best-effort and has no SLA.
