#!/bin/sh
# Makes a Linux machine into an Alpha server, or adds a named Alpha beside the first one. Run as
# root, from a folder holding this script, alpha, alpha.service, verify.mjs, signing-key.pub and
# .nvmrc. Safe to run again.
#   setup.sh <the owner's name> <the https address people reach it at, or none yet> [<name>]
# A named Alpha (avilo) is its own system user (alpha-avilo), data, sealed secrets, service and
# port, and shares nothing with the others but the machine, Node and the releases' code.
set -eu
OWNER=$1
ADDRESS=${2:-}
NAME=${3:-}
case $NAME in *[!a-z0-9]*) echo "An Alpha's name is small letters and digits."; exit 1 ;; esac
HERE=$(cd "$(dirname "$0")" && pwd)
NODE=$(cat "$HERE/.nvmrc")
case $(uname -m) in aarch64) ARCH=arm64 ;; x86_64) ARCH=x64 ;; *) echo "Not a machine Alpha runs on."; exit 1 ;; esac

export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get install -y -qq bubblewrap socat ripgrep curl xz-utils ca-certificates
# Tailscale is how people reach the machine; `pnpm server address` brings it up
if ! command -v tailscale >/dev/null; then
  . /etc/os-release
  curl -fsSL "https://pkgs.tailscale.com/stable/ubuntu/$VERSION_CODENAME.noarmor.gpg" \
    -o /usr/share/keyrings/tailscale-archive-keyring.gpg
  curl -fsSL "https://pkgs.tailscale.com/stable/ubuntu/$VERSION_CODENAME.tailscale-keyring.list" \
    -o /etc/apt/sources.list.d/tailscale.list
  apt-get update -qq
  apt-get install -y -qq tailscale
fi
# the sandbox makes its own namespaces, which Ubuntu turns off for ordinary programs by default
printf 'kernel.apparmor_restrict_unprivileged_userns=0\n' >/etc/sysctl.d/60-alpha.conf
sysctl -q --system
# and newer Ubuntu strips everything bubblewrap starts of the capabilities the sandbox's filter needs
if [ -f /etc/apparmor.d/bwrap-userns-restrict ]; then
  ln -sf /etc/apparmor.d/bwrap-userns-restrict /etc/apparmor.d/disable/bwrap-userns-restrict
  apparmor_parser -R /etc/apparmor.d/bwrap-userns-restrict 2>/dev/null || true
fi

if [ ! -x /opt/alpha/node/bin/node ] || [ "$(/opt/alpha/node/bin/node -v)" != "v$NODE" ]; then
  tmp=$(mktemp -d)
  name="node-v$NODE-linux-$ARCH.tar.xz"
  curl -fsSL "https://nodejs.org/dist/v$NODE/$name" -o "$tmp/$name"
  curl -fsSL "https://nodejs.org/dist/v$NODE/SHASUMS256.txt" -o "$tmp/sums"
  (cd "$tmp" && grep " $name\$" sums | sha256sum -c -)
  rm -rf /opt/alpha/node
  mkdir -p /opt/alpha/node /opt/alpha/releases
  tar -xJf "$tmp/$name" -C /opt/alpha/node --strip-components=1
  rm -rf "$tmp"
fi
export PATH=/opt/alpha/node/bin:$PATH
npm install -g --silent "pnpm@$(sed -n 's/.*"packageManager": "pnpm@\([^"]*\)".*/\1/p' "$HERE/package.json")"

if [ -n "$NAME" ]; then
  USER_=alpha-$NAME
  CRED=/etc/alpha/secrets-$NAME.cred
  UNIT=alpha-$NAME
  CURRENT=/opt/alpha/current-$NAME
else
  USER_=alpha
  CRED=/etc/alpha/secrets.cred
  UNIT=alpha
  CURRENT=/opt/alpha/current
fi
HOME_BASE=/home/$USER_
id "$USER_" >/dev/null 2>&1 || useradd --create-home --shell /usr/sbin/nologin "$USER_"
# each Alpha's home is closed to every other user on the machine
chmod 750 "$HOME_BASE"
install -d -o "$USER_" -g "$USER_" -m 750 "$HOME_BASE/data"
install -d -m 700 /etc/alpha
[ -f "$CRED" ] ||
  head -c 32 /dev/urandom | base64 -w0 | systemd-creds encrypt --name=alpha-secrets - "$CRED"

# a named Alpha's port: the next free one after the first Alpha's 4700, kept in /etc/alpha/ports
PORT=4700
if [ -n "$NAME" ]; then
  touch /etc/alpha/ports
  PORT=$(sed -n "s/^$NAME \([0-9]*\)$/\1/p" /etc/alpha/ports)
  if [ -z "$PORT" ]; then
    last=$(awk '{print $2}' /etc/alpha/ports | sort -n | tail -1)
    PORT=$(( ${last:-4700} + 10 ))
    printf '%s %s\n' "$NAME" "$PORT" >>/etc/alpha/ports
  fi
fi

if [ ! -f "$HOME_BASE/data/alpha.yaml" ]; then
  {
    printf 'owner: "%s"\nsign_in: true\nprepare_readers: true\n' "$OWNER"
    [ -n "$ADDRESS" ] && printf 'public_address: "%s"\n' "$ADDRESS"
    true
  } >"$HOME_BASE/data/alpha.yaml"
  chown "$USER_:$USER_" "$HOME_BASE/data/alpha.yaml"
fi

install -m 644 "$HERE/signing-key.pub" /opt/alpha/signing-key.pub
install -m 644 "$HERE/verify.mjs" /opt/alpha/verify.mjs
install -m 755 "$HERE/alpha" /usr/local/bin/alpha
# the service: the first Alpha's as it comes; a named one's with its own user, home, port, release
# and secrets
sed -e "s|^Description=Alpha$|Description=Alpha${NAME:+ ($NAME)}|" \
  -e "s|^User=alpha$|User=$USER_|" -e "s|^Group=alpha$|Group=$USER_|" \
  -e "s|^Environment=HOME=/home/alpha$|Environment=HOME=$HOME_BASE|" \
  -e "s|^Environment=ALPHA_HOME=/home/alpha/data$|Environment=ALPHA_HOME=$HOME_BASE/data\nEnvironment=ALPHA_PORT=$PORT|" \
  -e "s|^WorkingDirectory=/opt/alpha/current/core$|WorkingDirectory=$CURRENT/core|" \
  -e "s|^LoadCredentialEncrypted=alpha-secrets:/etc/alpha/secrets.cred$|LoadCredentialEncrypted=alpha-secrets:$CRED|" \
  "$HERE/alpha.service" >"/etc/systemd/system/$UNIT.service"
chmod 644 "/etc/systemd/system/$UNIT.service"
systemctl daemon-reload
systemctl enable -q "$UNIT"
# a named Alpha starts on the release the first one runs, until it is sent its own
if [ -n "$NAME" ] && [ ! -L "$CURRENT" ] && [ -L /opt/alpha/current ]; then
  ln -sfn "$(readlink /opt/alpha/current)" "$CURRENT"
  systemctl restart "$UNIT"
fi
echo "This machine is set up${NAME:+ for $NAME}. Send it a release with: pnpm server update"

