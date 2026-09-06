#!/usr/bin/env bash
# Regenerate the home-screen and favicon PNGs.
#
# Compiled at 72 ppi so the pt page size equals the pixel size exactly.
# Needs a colour emoji font: Segoe UI Emoji on Windows, Apple Color Emoji on macOS.
set -euo pipefail

cd "$(dirname "$0")"

for size in 32 180 192 512; do
  typst compile --input "size=${size}" --format png --ppi 72 icon.typ "icon-${size}.png" 2>/dev/null
  echo "  icon-${size}.png"
done

echo "done"
