#!/bin/sh
# Installs Alpha on this Mac, or updates it (packaging, piece 3; Kenil's ask of 21 Oct: no
# Terminal). Three ways in, the same steps:
#   Alpha.app itself, on its first open (--from-app <bundle>): the window shows these lines
#   sh /Volumes/Alpha/Alpha.app/Contents/Resources/app/install.sh   (from the disk image)
#   sh install.sh                                                     (an unpacked Alpha folder)
# It checks the Mac, clears macOS's download mark from Alpha's own files only, puts Alpha.app in
# Applications when it is not there yet (no administrator password), hands over the kits that came
# with it, sets Alpha and its core to start at login, and starts the core. Updating, it backs up
# the data first, keeps the old Alpha one step back, and puts it back if the new one does not
# start. From Terminal it also runs Claude's own sign-in and opens Alpha; from the app, Alpha's
# window does both.
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
# the core's own tools (backup, restore) find the data by these
export ALPHA_HOME="$DATA" ALPHA_LOG_DIR="$LOGS"
# the port the core answers on, as the core takes it: ALPHA_PORT, else alpha.yaml's, else 4700
PORT="${ALPHA_PORT:-$(sed -n 's/^port: *//p' "$DATA/alpha.yaml" 2>/dev/null | head -1)}"
PORT="${PORT:-4700}"
say() { printf '\n%s\n' "$*"; }
fail() { printf '\n%s\n' "$*"; exit 1; }

# Where the new Alpha is: the app that runs this, the app this script sits inside, or the one
# beside it in an unpacked folder.
from_app=""
if [ "$1" = "--from-app" ]; then
  from_app=1
  SRC="$(cd "$2" && pwd)"
else
  case "$here" in
    */Alpha.app/Contents/Resources/app) SRC="$(cd "$here/../../.." && pwd)" ;;
    *) SRC="$here/Alpha.app" ;;
  esac
fi
[ -d "$SRC/Contents/Resources/app" ] || fail "Run install.sh from the Alpha folder it came in, beside Alpha.app."
new="$(cat "$SRC/Contents/Resources/app/VERSION")"
in_place=""
[ "$SRC" = "$APP" ] && in_place=1

# The Mac: Apple silicon, macOS 14 or newer, room for Alpha and what reading needs.
[ "$(uname -m)" = arm64 ] || fail "Alpha needs a Mac with Apple silicon (M1 or later)."
version="$(sw_vers -productVersion)"
[ "${version%%.*}" -ge 14 ] || fail "Alpha needs macOS 14 Sonoma or newer; this Mac has $version."
free="$(df -k "$HOME" | awk 'NR==2 {print $4}')"
[ "$free" -gt 3000000 ] || fail "Alpha needs about 3 GB free on this Mac; it has $((free / 1000000)) GB."
# A shared or network drive cannot carry the links inside Alpha's packages (a virtual machine's
# shared folder, a file server): the folder has to be on this Mac first.
vol="$(df -P "$SRC" | awk 'NR==2 {print $1}')"
if mount | grep -F "$vol on " | grep -Eiq 'virtiofs|smbfs|afpfs|nfs|webdav|fuse'; then
  fail "The Alpha folder is on a shared or network drive. Copy it to this Mac's Desktop first, then run install.sh from there."
fi

# macOS marks downloaded files; Alpha's own are not notarized yet (Step A), so the mark comes off
# them, and only them.
xattr -dr com.apple.quarantine "$SRC" 2>/dev/null || true
[ -n "$from_app" ] || xattr -dr com.apple.quarantine "$here" 2>/dev/null || true

updating=""
# an earlier install that never finished (no runtime or manifest inside: the manifest is the
# last file a release writes) is set aside, never deleted
if [ -z "$in_place" ] && [ -d "$APP" ] && { ! [ -x "$PAY/runtime/node" ] || ! [ -f "$PAY/MANIFEST" ]; }; then
  say "Setting aside an Alpha that was not installed whole."
  launchctl bootout "$DOMAIN/$LABEL" 2>/dev/null || true
  mkdir -p "$DATA/previous"
  rm -rf "$DATA/previous/Alpha.partial.app"
  mv "$APP" "$DATA/previous/Alpha.partial.app"
fi
if [ -f "$PLIST" ] || { [ -d "$APP" ] && [ -z "$in_place" ]; }; then
  updating="$(cat "$DATA/version" 2>/dev/null || echo 'an earlier version')"
  if [ "$updating" = "$new" ] && [ -n "$in_place" ]; then
    say "Alpha $new is already installed."
    exit 0
  fi
  say "Updating Alpha $updating to $new. Backing up your data first."
  stamp="$(date +%Y-%m-%d-%H%M%S)"
  mkdir -p "$DATA/updates/$stamp"
  backup_with="$PAY/runtime/node"
  [ -x "$backup_with" ] || backup_with="$SRC/Contents/Resources/app/runtime/node"
  if ! "$backup_with" "$(dirname "$backup_with")/../core/src/cli.ts" backup "$DATA/updates/$stamp/worlds" >/dev/null 2>&1; then
    say "The backup of your data did not work, so Alpha was not updated; nothing changed. Try again, or ask for help with $DATA/updates/$stamp."
    exit 1
  fi
  launchctl bootout "$DOMAIN/$LABEL" 2>/dev/null || true
  i=0
  while curl -s -o /dev/null -m 2 "http://127.0.0.1:$PORT/api/health"; do i=$((i + 1)); [ "$i" -gt 30 ] && break; sleep 1; done
  if [ -z "$in_place" ] && [ -d "$APP" ]; then
    rm -rf "$DATA/previous"
    mkdir -p "$DATA/previous"
    mv "$APP" "$DATA/previous/Alpha.app"
  fi
else
  say "Installing Alpha $new."
fi

if [ -z "$in_place" ]; then
  say "Putting Alpha in Applications."
  ditto "$SRC" "$APP"
fi
# The copy is on this Mac now: the download mark comes off it here, where it can. With the mark
# on, macOS refuses to run the core at all (launchd: OS_REASON_CODESIGNING), and nothing says so.
xattr -dr com.apple.quarantine "$APP" 2>/dev/null || true
if xattr -p com.apple.quarantine "$PAY/runtime/node" >/dev/null 2>&1; then
  fail "macOS's download mark could not be taken off Alpha's files, so it would not be allowed to run. Send Kenil a note."
fi
mkdir -p "$DATA/kits/inbox" "$LOGS" "$HOME/Library/LaunchAgents"
for k in "$APP/Contents/Resources/kits"/*.alphakit "$here"/kits/*.alphakit; do
  [ -f "$k" ] && cp "$k" "$DATA/kits/inbox/"
done
printf '%s\n' "$new" > "$DATA/version"

# What the installer knows about this Alpha, in alpha.yaml: where its helper, uv and log live,
# and that the installed app keeps the Mac awake and readies the readers; the address a report
# is for comes with the release. Lines the person or the core wrote (owner, tenant, keep_awake)
# stay as they are.
CONF="$DATA/alpha.yaml"
[ -f "$CONF" ] || printf '# What the installer knows about this Alpha; the environment overrides it for a development run.\n' > "$CONF"
setline() {
  if grep -q "^$1:" "$CONF"; then sed -i '' "s|^$1:.*|$1: $2|" "$CONF"; else printf '%s: %s\n' "$1" "$2" >> "$CONF"; fi
}
setline helper "\"$PAY/helper/Alpha Helper.app\""
setline uv "\"$PAY/runtime/uv\""
setline logs "\"$LOGS\""
setline prepare_readers true
grep -q "^keep_awake:" "$CONF" || setline keep_awake true
if [ -f "$PAY/release.yaml" ]; then
  rt="$(sed -n 's/^report_to: *//p' "$PAY/release.yaml" | head -1)"
  [ -n "$rt" ] && setline report_to "$rt"
fi

# Alpha's core starts at login, with its own Node and only macOS's own PATH; the rest is in
# alpha.yaml.
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
    <key>ALPHA_LOGIN_ITEM</key><string>1</string>
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
# launchd sometimes pends a start-at-load ("domain in on-demand-only mode") and never spawns;
# an explicit demand starts it whatever the mode
launchctl kickstart "$DOMAIN/$LABEL" 2>/dev/null || true

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

say "Starting Alpha. Its first start sets up your kits and can take a few minutes. macOS may say \"Background item added\": that is Alpha starting at login."
i=0
until curl -s -o /dev/null -m 10 "http://127.0.0.1:$PORT/api/health"; do
  i=$((i + 1))
  [ $((i % 30)) -eq 0 ] && say "Still starting ($((i / 60)) min)."
  if [ "$i" -gt 600 ]; then
    if [ -n "$updating" ] && [ -d "$DATA/previous/Alpha.app" ]; then
      say "The new Alpha did not start, so the earlier one is back. Its log: $LOGS/core.log"
      launchctl bootout "$DOMAIN/$LABEL" 2>/dev/null || true
      rm -rf "$APP"
      mv "$DATA/previous/Alpha.app" "$APP"
      xattr -dr com.apple.quarantine "$APP" 2>/dev/null || true
      "$PAY/runtime/node" "$PAY/core/src/cli.ts" restore "$DATA/updates/$stamp/worlds" >/dev/null 2>&1 || true
      cat "$PAY/VERSION" > "$DATA/version" 2>/dev/null || rm -f "$DATA/version"
      launchctl bootstrap "$DOMAIN" "$PLIST"
      launchctl kickstart "$DOMAIN/$LABEL" 2>/dev/null || true
      exit 1
    fi
    fail "Alpha did not start. Its log is $LOGS/core.log; send Kenil a report with: \"$PAY/bin/alpha\" report"
  fi
  sleep 1
done

if [ -n "$from_app" ]; then
  say "Alpha $new is ready."
  exit 0
fi

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
