#!/bin/sh
# Builds "Winter Arc.app" (a native window around the hub) with the Command Line Tools and
# installs it in /Applications. Needs no Xcode.
set -eu

HERE="$(cd "$(dirname "$0")" && pwd)"
REPO="$(cd "$HERE/.." && pwd)"
# Built under TMPDIR: files in Documents or Desktop carry attributes that make codesign refuse the bundle.
BUILD="${TMPDIR:-/tmp}/winter-arc-mac-build"
APP="$BUILD/Winter Arc.app"
ICONSET="$BUILD/AppIcon.iconset"

rm -rf "$APP" "$ICONSET"
mkdir -p "$APP/Contents/MacOS" "$APP/Contents/Resources" "$ICONSET"

swiftc -O "$HERE/WinterArc/main.swift" -o "$APP/Contents/MacOS/WinterArc" -framework Cocoa -framework WebKit

# App icon from the same artwork as the Android icon.
SRC="$REPO/assets/icon-only.png"
for size in 16 32 128 256 512; do
  sips -z $size $size "$SRC" --out "$ICONSET/icon_${size}x${size}.png" >/dev/null
  double=$((size * 2))
  sips -z $double $double "$SRC" --out "$ICONSET/icon_${size}x${size}@2x.png" >/dev/null
done
iconutil -c icns "$ICONSET" -o "$APP/Contents/Resources/AppIcon.icns"

cat > "$APP/Contents/Info.plist" <<'PLIST'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>CFBundleName</key><string>Winter Arc</string>
  <key>CFBundleDisplayName</key><string>Winter Arc</string>
  <key>CFBundleIdentifier</key><string>com.saif.winterarc.mac</string>
  <key>CFBundleExecutable</key><string>WinterArc</string>
  <key>CFBundleIconFile</key><string>AppIcon</string>
  <key>CFBundlePackageType</key><string>APPL</string>
  <key>CFBundleShortVersionString</key><string>1.0</string>
  <key>CFBundleVersion</key><string>1</string>
  <key>LSMinimumSystemVersion</key><string>13.0</string>
  <key>NSHighResolutionCapable</key><true/>
  <key>NSAppTransportSecurity</key>
  <dict><key>NSAllowsLocalNetworking</key><true/></dict>
</dict>
</plist>
PLIST

xattr -cr "$APP"
codesign --force --deep --sign - "$APP"
rm -rf "/Applications/Winter Arc.app"
ditto "$APP" "/Applications/Winter Arc.app"
echo "Installed /Applications/Winter Arc.app"
