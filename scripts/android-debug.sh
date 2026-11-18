#!/usr/bin/env bash
# Builds the Android app as a debug APK, for installing on a test phone.
# No Play account or signing key is needed: Android signs debug builds with
# a key it makes on this PC.
#
#   mise run android-debug        (Java 21 comes from mise.toml)
#   bash scripts/android-debug.sh --emulators
#
# --emulators builds a copy for testing on the Android emulator that opens
# the page with ?emu=1, so it talks to the Firebase emulators on this PC
# (forwarded with `adb reverse`) and never to the live project. Only debug
# builds may reach them, over plain http; see android/app/src/debug.
#
# Needs the Android SDK (platform 36, build-tools 36). It is looked for in
# ANDROID_HOME, then in the place Android Studio would put it.
set -euo pipefail

cd "$(dirname "$0")/.."

if [ -z "${ANDROID_HOME:-}" ]; then
  for d in "${LOCALAPPDATA:-}/Android/Sdk" "$HOME/Library/Android/sdk" "$HOME/Android/Sdk"; do
    if [ -d "$d/platforms" ]; then export ANDROID_HOME="$d"; break; fi
  done
fi
if [ -z "${ANDROID_HOME:-}" ]; then
  echo "Android SDK not found: set ANDROID_HOME" >&2
  exit 1
fi

OUT=build/DinnerDecisions-debug.apk
[ "${1:-}" = "--emulators" ] && OUT=build/DinnerDecisions-emulators-debug.apk

node scripts/build-app.mjs
npx cap sync android
if [ "${1:-}" = "--emulators" ]; then
  # The config cap sync just wrote into the app; gitignored, rebuilt each time.
  node -e '
    const f = "android/app/src/main/assets/capacitor.config.json";
    const c = JSON.parse(require("fs").readFileSync(f, "utf8"));
    c.server = Object.assign({}, c.server, { appStartPath: "/index.html?emu=1" });
    require("fs").writeFileSync(f, JSON.stringify(c, null, "	"));'
fi

cd android
if [ -n "${WINDIR:-}" ]; then
  cmd //c ".\gradlew.bat assembleDebug --console=plain"
else
  ./gradlew assembleDebug --console=plain
fi
cd ..

mkdir -p build
cp android/app/build/outputs/apk/debug/app-debug.apk "$OUT"
echo "APK: $(pwd)/$OUT"
