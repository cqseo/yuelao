#!/usr/bin/env bash
set -euo pipefail
# Reproducible Yuexia player from Ara 3D Gen (MIT) and MakeHuman CC0 data.
HERE="$(cd "$(dirname "$0")" && pwd)"
ROOT="${ARA_SOURCE_DIR:-/tmp/yuexia-ara-generator}"
PIN="3d78dcad462feeeb64db7fe667a7c34105a10a45"
if [ ! -d "$ROOT/.git" ]; then
  git clone https://github.com/TuriaArt/3d-gen-TU.git "$ROOT"
fi
cd "$ROOT"
git checkout "$PIN"
npm ci
mkdir -p vendor/dl
if [ ! -d vendor/mh/makehuman/data ]; then
  git clone --depth 1 --filter=blob:none --sparse https://github.com/makehumancommunity/makehuman.git vendor/mh
  git -C vendor/mh sparse-checkout set makehuman/data
fi
if [ ! -d vendor/sys/skins ]; then
  curl --fail --location --retry 3 --output vendor/dl/sys.zip \
    https://files2.makehumancommunity.org/asset_packs/makehuman_system_assets/makehuman_system_assets_cc0.zip
  mkdir -p vendor/sys
  unzip -q -o vendor/dl/sys.zip -d vendor/sys
fi
npm run build-assets
if ! grep -q "id: 'yuexia_hanfu'" src/core/garments/catalog.ts; then
  git apply "$HERE/ara-hanfu.patch"
fi
cp "$HERE/ara-traveler.params.json" ./yuexia-traveler.params.json
npm run export -- --params yuexia-traveler.params.json --formats glb --out out
python3 "$HERE/trim_ara_glb.py" \
  out/Yuexia_Moonlit_Wanderer.glb \
  "$HERE/public/models/yuexia-ara-wanderer.glb"
sha256sum "$HERE/public/models/yuexia-ara-wanderer.glb"
echo "Character written; now build the independent preview."
