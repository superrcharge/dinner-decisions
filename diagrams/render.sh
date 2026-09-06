#!/usr/bin/env bash
# Compile every diagram source to a dual-theme SVG pair.
#
# Sources under design/ are imported modules, not diagrams, so they are skipped.
# A source marked `// render: static` keeps its fixed pt dimensions; everything
# else has them stripped so the SVG scales to its container in the README.
set -euo pipefail

cd "$(dirname "$0")"

for f in $(find . -type f -name '*.typ' -not -path './design/*' | sort); do
  base="${f%.typ}"
  if grep -qE '^//[[:space:]]*render:[[:space:]]*static\b' "$f"; then
    mode=static
  else
    mode=responsive
  fi

  for theme in light dark; do
    out="${base}-${theme}.svg"
    typst compile --root . --input "theme=${theme}" "$f" "$out"
    if [ "$mode" = "responsive" ]; then
      sed -i -E 's/ width="[0-9.]+pt"//; s/ height="[0-9.]+pt"//' "$out"
    fi
    echo "  ${out}  (${mode})"
  done
done

echo "done"
