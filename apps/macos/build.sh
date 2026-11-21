#!/usr/bin/env bash
set -euo pipefail

if [[ $(uname -s) != Darwin ]]; then
  printf '%s\n' 'Build The Hackers Bay native app on macOS with the Xcode command-line tools.' >&2
  exit 1
fi

here=$(CDPATH='' cd -- "$(dirname -- "$0")" && pwd)
art="$here/../../public/hackersbay/art"
out="${HACKERSBAY_MAC_OUTPUT:-$here/dist}"
mkdir -p "$out"
out=$(CDPATH='' cd -- "$out" && pwd)
stage=$(mktemp -d)
trap 'rm -rf "$stage"' EXIT
app="$stage/disk/The Hackers Bay.app"
resources="$app/Contents/Resources"
mkdir -p "$app/Contents/MacOS" "$resources" "$stage/Squawk.iconset"
cp "$here/Info.plist" "$app/Contents/"
cp "$here/Sources/watch-intros.js" "$resources/"
python3 "$here/sound-assets.py" "$resources"

for size in 16 32 128 256 512; do
  sips -z "$size" "$size" "$art/app-icon-512.png" --out "$stage/Squawk.iconset/icon_${size}x${size}.png" >/dev/null
  sips -z "$((size * 2))" "$((size * 2))" "$art/app-icon-512.png" --out "$stage/Squawk.iconset/icon_${size}x${size}@2x.png" >/dev/null
done
sips -z 36 36 "$art/captain-icon.png" --out "$resources/menu-squawk.png" >/dev/null
iconutil -c icns "$stage/Squawk.iconset" -o "$resources/Squawk.icns"

sdk=$(xcrun --sdk macosx --show-sdk-path)
for arch in arm64 x86_64; do
  xcrun swiftc -swift-version 5 -parse-as-library -O -sdk "$sdk" -target "$arch-apple-macos13.0" \
    "$here/Sources/HackersBay.swift" -o "$stage/HackersBay-$arch"
done
xcrun lipo -create "$stage/HackersBay-arm64" "$stage/HackersBay-x86_64" -output "$app/Contents/MacOS/HackersBay"
xcrun lipo "$app/Contents/MacOS/HackersBay" -verify_arch arm64 x86_64
codesign --force --sign - "$app"
codesign --verify --deep --strict "$app"
ln -s /Applications "$stage/disk/Applications"
hdiutil create -volname "The Hackers Bay" -srcfolder "$stage/disk" -format UDZO -ov "$out/HackersBay-native-universal.dmg"
hdiutil verify "$out/HackersBay-native-universal.dmg"
ditto -c -k --keepParent "$app" "$out/HackersBay-native-universal.app.zip"
(
  cd "$out"
  shasum -a 256 HackersBay-native-universal.dmg HackersBay-native-universal.app.zip > SHA256SUMS.txt
)
