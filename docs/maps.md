# Map hosting

[Back to SpiderRoute](../README.md)

At launch the browser uses OpenStreetMap standard tiles with attribution and HTTP caching. Tile requests send the application origin, not route paths or share tokens. Public OSM tiles are best-effort, for policy-compliant interactive use only. No bulk download, offline maps, or tile load testing.

The separate-server package in [ops/tiles](../ops/tiles/README.md) downloads/verifies a planet archive and pinned fonts/sprites, serves vector tiles over HTTPS, and generates styles. Nothing requires storing worldwide map data on the app server. Set `MAP_PROVIDER=self-hosted-vector` and `MAP_STYLE_URL` to switch, then restart. Route data does not change.
