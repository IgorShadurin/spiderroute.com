#!/usr/bin/env bash
set -euo pipefail
# Small supporting assets, not the planet tile archive. Run on the map server.
asset_commit=028c18f713baecad011301ff7a69acc39bcc2ae7
asset_target=${1:-ops/tiles/www/assets}
[[ ! -e "$asset_target" ]] || { echo 'Asset target already exists; use a new versioned directory for updates'; exit 1; }
mkdir -p "$asset_target"
git -C "$asset_target" init
git -C "$asset_target" remote add origin https://github.com/protomaps/basemaps-assets.git
git -C "$asset_target" fetch --depth 1 origin "$asset_commit"
git -C "$asset_target" checkout --detach FETCH_HEAD
printf '%s\n' "$asset_commit" > "$asset_target/.asset-version"
test -d "$asset_target/fonts"
test -f "$asset_target/sprites/v4/light.json"
echo 'Pinned map fonts and sprites ready.'
