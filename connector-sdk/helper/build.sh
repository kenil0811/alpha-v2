#!/bin/sh
# Builds Alpha's helper app into connector-sdk/helper/build/, signed ad hoc for development
# (Developer ID comes with the shipped app, week 6). It is rebuilt only when its source changes:
# a new build is a new signature, and macOS would ask the person again.
set -e
here="$(cd "$(dirname "$0")" && pwd)"
app="$here/build/Alpha Helper.app"
stamp="$here/build/source.sha256"
sum="$(cat "$here/AlphaHelper.swift" "$here/Info.plist" | shasum -a 256 | cut -d' ' -f1)"
if [ -x "$app/Contents/MacOS/alpha-helper" ] && [ -f "$stamp" ] && [ "$(cat "$stamp")" = "$sum" ]; then
  exit 0
fi
rm -rf "$app"
mkdir -p "$app/Contents/MacOS"
cp "$here/Info.plist" "$app/Contents/Info.plist"
xcrun swiftc -O -o "$app/Contents/MacOS/alpha-helper" "$here/AlphaHelper.swift"
codesign -s - -f --identifier com.alpha.helper "$app" >/dev/null 2>&1
echo "$sum" > "$stamp"
echo "Built Alpha's helper: $app"
