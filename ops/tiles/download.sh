#!/usr/bin/env bash
set -euo pipefail
# Run ON THE MAP SERVER. URL and checksum come from https://maps.protomaps.com/builds/.
archive_url=${1:?Usage: download.sh HTTPS_ARCHIVE_URL BLAKE3_HASH [DATA_DIRECTORY]}
archive_hash=${2:?BLAKE3 checksum required}
map_dir=${3:-/srv/spiderroute-maps}
[[ "$archive_url" == https://* ]] || { echo 'HTTPS URL required'; exit 1; }
[[ "$archive_hash" =~ ^[a-fA-F0-9]{64}$ ]] || { echo 'Invalid BLAKE3 hash'; exit 1; }
command -v b3sum >/dev/null || { echo 'Install b3sum first'; exit 1; }
mkdir -p "$map_dir"
available_kb=$(df -Pk "$map_dir" | awk 'NR==2 {print $4}')
(( available_kb >= 150000000 )) || { echo 'Need at least 150 GB free for a replacement archive'; exit 1; }
curl --fail --location --retry 5 --continue-at - --output "$map_dir/world.next.pmtiles" "$archive_url"
printf '%s  %s\n' "$archive_hash" "$map_dir/world.next.pmtiles" | b3sum --check
if [[ -f "$map_dir/world.pmtiles" ]]; then mv "$map_dir/world.pmtiles" "$map_dir/world.previous.pmtiles"; fi
mv "$map_dir/world.next.pmtiles" "$map_dir/world.pmtiles"
echo 'Archive installed. Restart the tiles service, verify health, and retain previous archive for rollback.'
