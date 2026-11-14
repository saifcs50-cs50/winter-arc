#!/bin/sh
# Checks the files in release/standard/ really are the standard (non-religious) edition.
# Run after: npm run apk:standard (and copying the APK) and mac/build-standalone.sh.
set -eu

REPO="$(cd "$(dirname "$0")/.." && pwd)"
APK="$REPO/release/standard/WinterArc-Standard-Android.apk"
ZIP="$REPO/release/standard/WinterArc-Standard-Mac.zip"
AAPT="$(ls -d "$HOME"/Library/Android/sdk/build-tools/*/ | sort | tail -1)aapt2"
RELIGIOUS='Tahajjud|Fajr|Salah|Adhkar|Masjid'
fail() { echo "FAIL: $1" >&2; exit 1; }

"$AAPT" dump badging "$APK" | grep -q "^package: name='com.winterarc.standard'" || fail "APK is not the standard app id"

JS="$(unzip -l "$APK" | grep -o 'assets/public/assets/index-[^ ]*\.js')"
unzip -p "$APK" "$JS" | grep -q '(`standard`)' || fail "APK web bundle is not built with VITE_EDITION=standard"

RES="$("$AAPT" dump resources "$APK")"
echo "$RES" | grep -A1 'string/alarm_channel_name' | grep -q 'Wake-up alarm' || fail "APK alarm channel is not named Wake-up alarm"
if echo "$RES" | grep -E '\(\) "' | grep -qE "$RELIGIOUS"; then fail "APK resources contain religious wording"; fi

for dex in $(unzip -l "$APK" | grep -o 'classes[0-9]*\.dex'); do
  if unzip -p "$APK" "$dex" | strings | grep -qE "$RELIGIOUS"; then fail "native code in $dex contains religious wording"; fi
done

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
ditto -x -k "$ZIP" "$TMP"
grep -q '(`standard`)' "$TMP/Winter Arc.app/Contents/Resources/web/assets/"index-*.js || fail "Mac app web bundle is not the standard edition"
lipo -archs "$TMP/Winter Arc.app/Contents/MacOS/WinterArc" | grep -q "x86_64 arm64" || fail "Mac app is not universal"
codesign -v "$TMP/Winter Arc.app" || fail "Mac app signature is broken"

echo "OK: release/standard is the standard edition (APK + Mac app)"
