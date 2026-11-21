#!/bin/bash
# Builds the installable apps into ../dist  (run from anywhere:  bash desktop/build.sh)
set -euo pipefail
cd "$(dirname "$0")"
OUT="$(cd .. && pwd)/dist"
NAME="Carusel Studio"

cp ../carusel-studio.html index.html
[ -d node_modules ] || npm install --no-audit --no-fund

# icon: PNG -> .icns (Mac) and .ico (Windows)
node make-icon.js build
rm -rf build/icon.iconset && mkdir build/icon.iconset
for s in 16 32 128 256 512; do
  sips -z $s $s build/icon-1024.png --out build/icon.iconset/icon_${s}x${s}.png >/dev/null
  sips -z $((s*2)) $((s*2)) build/icon-1024.png --out build/icon.iconset/icon_${s}x${s}@2x.png >/dev/null
done
iconutil -c icns build/icon.iconset -o build/icon.icns

IGNORE='^/(build|build\.sh|make-icon\.js|package-lock\.json)($|/)'
for target in darwin:arm64 darwin:x64 win32:x64; do
  npx electron-packager . "$NAME" --platform="${target%%:*}" --arch="${target##*:}" \
    --out="$OUT" --overwrite --icon=build/icon --ignore="$IGNORE" \
    --app-bundle-id=ro.carusel.studio --app-copyright="Carusel Studio"
done

# ad-hoc sign the Mac apps so they start on Apple Silicon
for a in arm64 x64; do codesign --force --deep -s - "$OUT/$NAME-darwin-$a/$NAME.app"; done

# single files that are easy to copy to another computer
cd "$OUT"
rm -f *.zip
ditto -c -k --keepParent "$NAME-win32-x64" "Carusel Studio - Windows.zip"
ditto -c -k --keepParent "$NAME-darwin-arm64/$NAME.app" "Carusel Studio - Mac (Apple Silicon).zip"
ditto -c -k --keepParent "$NAME-darwin-x64/$NAME.app" "Carusel Studio - Mac (Intel).zip"
ls -lh *.zip
