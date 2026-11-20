#!/usr/bin/env bash
# Build the iPhone app and run it in Apple's iOS Simulator (Mac only).
#
#   mise run ios-sim                    (talks to the live project, like a family's phone)
#   bash scripts/ios-sim.sh --emulators (talks to the Firebase emulators on this Mac)
#
# --emulators opens the page with ?emu=1, so the app never touches the live
# project; start the emulators first (see README). The simulator shares the
# Mac's network, so 127.0.0.1 reaches them directly. Capacitor on iOS checks
# the start path as a file, so a query string cannot go in appStartPath the
# way the Android build does it; instead a tiny emu.html in the generated
# public/ folder hops to index.html?emu=1. Both files are gitignored and
# rewritten by every cap sync.
#
# Needs Xcode with the iOS platform installed. Uses the booted iPhone
# simulator, or boots the first available one. DEVICE=<name or udid> picks.
# The built app lands in build/ios/Build/Products/Debug-iphonesimulator/App.app.
set -euo pipefail
cd "$(dirname "$0")/.."

node scripts/build-app.mjs
npx cap sync ios
if [ "${1:-}" = "--emulators" ]; then
  printf '%s\n' \
    '<!doctype html><meta charset="utf-8"><title>Dinner Decisions (emulators)</title>' \
    '<script>location.replace("index.html?emu=1");</script>' > ios/App/App/public/emu.html
  node -e '
    const f = "ios/App/App/capacitor.config.json";
    const c = JSON.parse(require("fs").readFileSync(f, "utf8"));
    c.server = Object.assign({}, c.server, { appStartPath: "emu.html" });
    require("fs").writeFileSync(f, JSON.stringify(c, null, "	"));'
fi

UDID=$(xcrun simctl list devices available -j | node -e '
  const want = process.argv[1];
  const all = Object.values(JSON.parse(require("fs").readFileSync(0, "utf8")).devices).flat()
    .filter(d => d.isAvailable && /iPhone/.test(d.name));
  const pick = want ? all.find(d => d.udid === want || d.name === want)
    : all.find(d => d.state === "Booted") || all[0];
  if (!pick) { console.error("No iPhone simulator found" + (want ? " for " + want : "")); process.exit(1); }
  process.stdout.write(pick.udid);' "${DEVICE:-}")

xcodebuild build -quiet \
  -project ios/App/App.xcodeproj -scheme App \
  -destination "platform=iOS Simulator,id=$UDID" \
  -derivedDataPath build/ios CODE_SIGNING_ALLOWED=NO

APP=build/ios/Build/Products/Debug-iphonesimulator/App.app
xcrun simctl boot "$UDID" 2>/dev/null || true
# Shows the device: Simulator.app up to Xcode 26, DeviceHub from Xcode 27. Headless is fine too.
open -b com.apple.iphonesimulator 2>/dev/null || open -a "$(xcode-select -p)/../Applications/DeviceHub.app" 2>/dev/null || true
xcrun simctl install "$UDID" "$APP"
xcrun simctl launch "$UDID" app.dinnerdecisions >/dev/null
echo "Running on simulator $UDID: $APP"
