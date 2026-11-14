#!/bin/sh
# Builds the self-contained Winter Arc Mac app (standard edition, hub built in, Intel + Apple Silicon)
# and zips it into release/standard/. Needs only the Command Line Tools.
#   mac/build-standalone.sh               full build + zip
#   mac/build-standalone.sh --test-binary x86_64 binary only, for the hub contract test
set -eu

HERE="$(cd "$(dirname "$0")" && pwd)"
REPO="$(cd "$HERE/.." && pwd)"
SRC="$HERE/Standalone"
# Built under TMPDIR: files in Documents or Desktop carry attributes that make codesign refuse the bundle.
BUILD="${TMPDIR:-/tmp}/winter-arc-standalone-build"
APP="$BUILD/Winter Arc.app"
OUT="$REPO/release/standard"
SWIFT_FILES="$SRC/main.swift $SRC/Hub.swift $SRC/HTTP.swift $SRC/SyncState.swift"
FRAMEWORKS="-framework Cocoa -framework WebKit -framework Network -framework ServiceManagement"

compile() {
  # shellcheck disable=SC2086
  swiftc -O -swift-version 5 -target "$1-apple-macos13" $SWIFT_FILES -o "$2" $FRAMEWORKS
}

mkdir -p "$BUILD"
if [ "${1:-}" = "--test-binary" ]; then
  compile x86_64 "$BUILD/WinterArc-test"
  echo "$BUILD/WinterArc-test"
  exit 0
fi

(cd "$REPO" && npm run build:standard >/dev/null)

rm -rf "$APP" "$BUILD/AppIcon.iconset"
mkdir -p "$APP/Contents/MacOS" "$APP/Contents/Resources" "$BUILD/AppIcon.iconset"
compile x86_64 "$BUILD/WinterArc-x86_64"
compile arm64 "$BUILD/WinterArc-arm64"
lipo -create -output "$APP/Contents/MacOS/WinterArc" "$BUILD/WinterArc-x86_64" "$BUILD/WinterArc-arm64"
cp -R "$REPO/dist-standard" "$APP/Contents/Resources/web"

ICON="$REPO/assets/icon-only.png"
for size in 16 32 128 256 512; do
  sips -z $size $size "$ICON" --out "$BUILD/AppIcon.iconset/icon_${size}x${size}.png" >/dev/null
  double=$((size * 2))
  sips -z $double $double "$ICON" --out "$BUILD/AppIcon.iconset/icon_${size}x${size}@2x.png" >/dev/null
done
iconutil -c icns "$BUILD/AppIcon.iconset" -o "$APP/Contents/Resources/AppIcon.icns"

cat > "$APP/Contents/Info.plist" <<'PLIST'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>CFBundleName</key><string>Winter Arc</string>
  <key>CFBundleDisplayName</key><string>Winter Arc</string>
  <key>CFBundleIdentifier</key><string>com.winterarc.standard.mac</string>
  <key>CFBundleExecutable</key><string>WinterArc</string>
  <key>CFBundleIconFile</key><string>AppIcon</string>
  <key>CFBundlePackageType</key><string>APPL</string>
  <key>CFBundleShortVersionString</key><string>1.0</string>
  <key>CFBundleVersion</key><string>1</string>
  <key>LSMinimumSystemVersion</key><string>13.0</string>
  <key>NSHighResolutionCapable</key><true/>
  <key>NSLocalNetworkUsageDescription</key><string>Winter Arc syncs with your phone over your Wi-Fi.</string>
  <key>NSBonjourServices</key><array><string>_winterarc._tcp</string></array>
  <key>NSAppTransportSecurity</key>
  <dict><key>NSAllowsLocalNetworking</key><true/></dict>
</dict>
</plist>
PLIST

xattr -cr "$APP"
codesign --force --deep --sign - "$APP"
mkdir -p "$OUT"
rm -f "$OUT/WinterArc-Standard-Mac.zip"
ditto -c -k --keepParent "$APP" "$OUT/WinterArc-Standard-Mac.zip"
lipo -archs "$APP/Contents/MacOS/WinterArc"
echo "Built $OUT/WinterArc-Standard-Mac.zip"
