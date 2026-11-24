#!/bin/sh
# Builds Alpha's helper app into connector-sdk/helper/build/ (or into the directory given), for
# Alpha's own Mac; with tool as the second word, a plain command inside the directory instead, for
# an app that carries it (Alpha Bridge), so macOS names that app as asking and lists no second one;
# macOS 14 and later on Apple silicon. It is signed with the one code-signing certificate that never
# changes ("Alpha Code Signing", or ALPHA_SIGN_IDENTITY), so the Keychain, Calendar and Contacts
# keep their yes across builds; without it, ad hoc for development, which macOS asks about again
# after every build. It is rebuilt only when its source changes.
set -e
here="$(cd "$(dirname "$0")" && pwd)"
out="${1:-$here/build}"
app="$out/Alpha Helper.app"
stamp="$out/source.sha256"
tool="${2:-}"
identity="${ALPHA_SIGN_IDENTITY:-Alpha Code Signing}"
if security find-identity -v -p codesigning 2>/dev/null | grep -q "\"$identity\""; then
  sign="$identity"
else
  sign="-"
fi
sum="$(cat "$here/AlphaHelper.swift" "$here/Info.plist" "$0" | shasum -a 256 | cut -d' ' -f1) $sign $tool"
if [ "$tool" = "tool" ]; then
  bin="$out/alpha-helper"
  if [ -x "$bin" ] && [ -f "$stamp" ] && [ "$(cat "$stamp")" = "$sum" ]; then
    exit 0
  fi
  mkdir -p "$out"
  xcrun swiftc -O -target arm64-apple-macos14 -lsqlite3 -o "$bin" "$here/AlphaHelper.swift"
  codesign -s "$sign" -f --identifier io.github.kenil0811.alpha.helper "$bin" >/dev/null 2>&1
  echo "$sum" > "$stamp"
  echo "Built Alpha's helper as a command: $bin"
  exit 0
fi
if [ -x "$app/Contents/MacOS/alpha-helper" ] && [ -f "$stamp" ] && [ "$(cat "$stamp")" = "$sum" ]; then
  exit 0
fi
rm -rf "$app"
mkdir -p "$app/Contents/MacOS"
cp "$here/Info.plist" "$app/Contents/Info.plist"
xcrun swiftc -O -target arm64-apple-macos14 -lsqlite3 -o "$app/Contents/MacOS/alpha-helper" "$here/AlphaHelper.swift"
codesign -s "$sign" -f --identifier io.github.kenil0811.alpha.helper "$app" >/dev/null 2>&1
echo "$sum" > "$stamp"
if [ "$sign" = "-" ]; then
  echo "Built Alpha's helper, signed ad hoc (no \"$identity\" certificate on this Mac): $app"
else
  echo "Built Alpha's helper, signed with \"$identity\": $app"
fi
