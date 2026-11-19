#!/usr/bin/env bash
# The store apps' icon and splash screens, from the same drawing as the
# website's icon (icon.typ): the pot on the app's green.
#
# Renders the sources into assets/, then Capacitor's generator turns them
# into every size Android and iOS ask for, inside android/ and ios/.
# Needs typst; the pot is icons/pot.svg.
set -euo pipefail

cd "$(dirname "$0")/.."
mkdir -p assets
GREEN="#176B4B"

render() { # out size scale bg
  typst compile --input "size=$2" --input "scale=$3" --input "bg=$4" --format png --ppi 72 icons/icon.typ "assets/$1" 2>/dev/null
  echo "  assets/$1"
}

# iOS and the store listings: the whole square, as on the website.
render icon-only.png 1024 0.62 "$GREEN"
# Android's adaptive icon: a green back layer and a transparent front layer.
# The generator insets the front layer to Android's safe zone itself, so the
# pot is drawn at the same size as on the full icon.
render icon-background.png 1024 0 "$GREEN"
render icon-foreground.png 1024 0.62 none
# Splash screens: the pot, small, centred on the green.
render splash.png 2732 0.20 "$GREEN"
render splash-dark.png 2732 0.20 "$GREEN"

npx capacitor-assets generate --android --ios \
  --iconBackgroundColor "$GREEN" --iconBackgroundColorDark "$GREEN" \
  --splashBackgroundColor "$GREEN" --splashBackgroundColorDark "$GREEN"
