#!/bin/sh
# Installs Alpha on this Mac, or updates it (packaging, piece 3). Run from the unpacked Alpha folder:
#   sh install.sh
# It checks the Mac, clears macOS's download mark from Alpha's own files only, puts Alpha.app in
# Applications (no administrator password), hands over the kits that came with it, sets Alpha to
# start at login, starts it, runs Claude's own sign-in when this Mac is not signed in, and opens
# Alpha. Updating, it backs up the data first, keeps the old Alpha one step back, and puts it back
# if the new one does not start.
set -e
here="$(cd "$(dirname "$0")" && pwd)"
LABEL=io.github.kenil0811.alpha.core
DOMAIN="gui/$(id -u)"
DATA="$HOME/Library/Application Support/Alpha"
LOGS="$HOME/Library/Logs/Alpha"
PLIST="$HOME/Library/LaunchAgents/$LABEL.plist"
APP_LABEL=io.github.kenil0811.alpha.app
APP_PLIST="$HOME/Library/LaunchAgents/$APP_LABEL.plist"
APP=/Applications/Alpha.app
PAY="$APP/Contents/Resources/app"
say() { printf '\n%s\n' "$*"; }
fail() { printf '\n%s\n' "$*"; exit 1; }

# The Mac: Apple silicon, macOS 14 or newer, room for Alpha and what reading needs.
[ "$(uname -m)" = arm64 ] || fail "Alpha needs a Mac with Apple silicon (M1 or later)."
version="$(sw_vers -productVersion)"
[ "${version%%.*}" -ge 14 ] || fail "Alpha needs macOS 14 Sonoma or newer; this Mac has $version."
free="$(df -k "$HOME" | awk 'NR==2 {print $4}')"
[ "$free" -gt 3000000 ] || fail "Alpha needs about 3 GB free on this Mac; it has $((free / 1000000)) GB."
[ -d "$here/Alpha.app" ] || fail "Run install.sh from the Alpha folder it came in, beside Alpha.app."
new="$(cat "$here/Alpha.app/Contents/Resources/app/VERSION")"

# macOS marks downloaded files; Alpha's own are not notarized yet (Step A), so the mark comes off
# them, and only them.
xattr -dr com.apple.quarantine "$here" 2>/dev/null || true

updating=""
if [ -d "$APP" ]; then
  updating="$(cat "$PAY/VERSION" 2>/dev/null || echo 'an earlier version')"
  say "Updating Alpha $updating to $new. Backing up your data first."
  stamp="$(date +%Y-%m-%d-%H%M%S)"
  mkdir -p "$DATA/updates/$stamp"
  "$PAY/runtime/node" "$PAY/core/src/cli.ts" backup "$DATA/updates/$stamp/worlds" >/dev/null
  "$PAY/bin/alpha" stop >/dev/null 2>&1 || true
  osascript -e 'tell application id "io.github.kenil0811.alpha" to quit' >/dev/null 2>&1 || true
  rm -rf "$DATA/previous"
  mkdir -p "$DATA/previous"
  mv "$APP" "$DATA/previous/Alpha.app"
else
  say "Installing Alpha $new."
fi

ditto "$here/Alpha.app" "$APP"
mkdir -p "$DATA/kits/inbox" "$LOGS" "$HOME/Library/LaunchAgents"
for k in "$here"/kits/*.alphakit; do
  [ -f "$k" ] && cp "$k" "$DATA/kits/inbox/"
done

# Alpha starts at login, with its own Node, helper and uv, and only macOS's own PATH.
cat > "$PLIST" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>$LABEL</string>
  <key>ProgramArguments</key>
  <array>
    <string>$PAY/runtime/node</string>
    <string>$PAY/core/src/main.ts</string>
  </array>
  <key>WorkingDirectory</key><string>$DATA</string>
  <key>EnvironmentVariables</key>
  <dict>
    <key>ALPHA_HOME</key><string>$DATA</string>
    <key>ALPHA_LOG_DIR</key><string>$LOGS</string>
    <key>ALPHA_HELPER_APP</key><string>$PAY/helper/Alpha Helper.app</string>
    <key>ALPHA_UV</key><string>$PAY/runtime/uv</string>
    <key>ALPHA_PREPARE_READERS</key><string>1</string>
    <key>ALPHA_KEEP_AWAKE</key><string>1</string>
    <key>PATH</key><string>/usr/bin:/bin:/usr/sbin:/sbin</string>
  </dict>
  <key>RunAtLoad</key><true/>
  <key>KeepAlive</key><dict><key>SuccessfulExit</key><false/></dict>
  <key>ThrottleInterval</key><integer>10</integer>
  <key>StandardOutPath</key><string>$LOGS/launchd.log</string>
  <key>StandardErrorPath</key><string>$LOGS/launchd.log</string>
</dict>
</plist>
PLIST
launchctl bootout "$DOMAIN/$LABEL" 2>/dev/null || true
launchctl bootstrap "$DOMAIN" "$PLIST"

# Alpha's app opens at login too, quietly: no window, only its face in the corner and its mark in
# the menu bar (the person hides the face from the menu bar if they want it gone).
cat > "$APP_PLIST" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>$APP_LABEL</string>
  <key>ProgramArguments</key>
  <array>
    <string>/usr/bin/open</string>
    <string>-g</string>
    <string>$APP</string>
    <string>--args</string>
    <string>--quietly</string>
  </array>
  <key>RunAtLoad</key><true/>
  <key>LimitLoadToSessionType</key><string>Aqua</string>
</dict>
</plist>
PLIST

say "Starting Alpha. macOS may say \"Background item added\": that is Alpha starting at login."
i=0
until curl -s -o /dev/null -m 2 "http://127.0.0.1:4700/api/health"; do
  i=$((i + 1))
  if [ "$i" -gt 90 ]; then
    if [ -n "$updating" ] && [ -d "$DATA/previous/Alpha.app" ]; then
      say "The new Alpha did not start, so the earlier one is back. Its log: $LOGS/core.log"
      launchctl bootout "$DOMAIN/$LABEL" 2>/dev/null || true
      rm -rf "$APP"
      mv "$DATA/previous/Alpha.app" "$APP"
      "$PAY/runtime/node" "$PAY/core/src/cli.ts" restore "$DATA/updates/$stamp/worlds" >/dev/null
      launchctl bootstrap "$DOMAIN" "$PLIST"
      exit 1
    fi
    fail "Alpha did not start. Its log is $LOGS/core.log; send Kenil a report with: \"$PAY/bin/alpha\" report"
  fi
  sleep 1
done

# Claude, on this person's own subscription: Claude's own sign-in, when this Mac is not signed in.
CLAUDE="$(find "$PAY/node_modules/.pnpm" -path '*claude-agent-sdk-darwin-arm64*' -name claude -type f | head -1)"
if [ -n "$CLAUDE" ] && ! "$CLAUDE" auth status 2>/dev/null | grep -q '"loggedIn": true'; then
  say "Now Claude's own sign-in. A page opens in your browser: sign in with your Claude account there, then come back here. Alpha never sees your sign-in."
  "$CLAUDE" auth login || say "Claude's sign-in did not finish; run it later with: \"$PAY/bin/alpha\" signin"
fi

open "$APP"
if [ -n "$updating" ]; then
  say "Alpha is updated to $new and open. Your data and settings are as they were."
else
  say "Alpha is installed and open in its own window; its face sits in a corner of your screen, and its mark in the menu bar. macOS asks once whether Alpha may send notifications. You can close Terminal."
fi
