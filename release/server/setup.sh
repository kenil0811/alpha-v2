#!/bin/sh
# Makes a Linux machine into one firm's Alpha server. Run once as root, from a folder holding this
# script, alpha, alpha.service, verify.mjs, signing-key.pub and .nvmrc. Safe to run again.
#   setup.sh <the owner's name> <the https address people reach it at, or none yet>
set -eu
OWNER=$1
ADDRESS=${2:-}
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

id alpha >/dev/null 2>&1 || useradd --create-home --shell /usr/sbin/nologin alpha
install -d -o alpha -g alpha /home/alpha/data
install -d -m 700 /etc/alpha
[ -f /etc/alpha/secrets.cred ] ||
  head -c 32 /dev/urandom | base64 -w0 | systemd-creds encrypt --name=alpha-secrets - /etc/alpha/secrets.cred

if [ ! -f /home/alpha/data/alpha.yaml ]; then
  {
    printf 'owner: "%s"\nsign_in: true\nprepare_readers: true\n' "$OWNER"
    [ -n "$ADDRESS" ] && printf 'public_address: "%s"\n' "$ADDRESS"
    true
  } >/home/alpha/data/alpha.yaml
  chown alpha:alpha /home/alpha/data/alpha.yaml
fi

install -m 644 "$HERE/signing-key.pub" /opt/alpha/signing-key.pub
install -m 644 "$HERE/verify.mjs" /opt/alpha/verify.mjs
install -m 755 "$HERE/alpha" /usr/local/bin/alpha
install -m 644 "$HERE/alpha.service" /etc/systemd/system/alpha.service
systemctl daemon-reload
systemctl enable -q alpha
echo "This machine is set up. Send it a release with: pnpm server update"
