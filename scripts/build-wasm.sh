#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."

wasm-pack build engine/crates/hem-wasm \
  --target web \
  --release \
  --out-dir "$PWD/web/public/wasm" \
  --out-name hem

rm -f web/public/wasm/.gitignore web/public/wasm/package.json

echo
echo "Built: $(stat -c%s web/public/wasm/hem_bg.wasm) bytes raw"
if command -v gzip >/dev/null; then
  echo "       $(gzip -c -9 web/public/wasm/hem_bg.wasm | wc -c) bytes gzip-9"
fi
if command -v brotli >/dev/null; then
  echo "       $(brotli -c -q 11 web/public/wasm/hem_bg.wasm | wc -c) bytes brotli-11"
fi
