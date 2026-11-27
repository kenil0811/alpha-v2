#!/bin/sh
# Alpha's Linux for a Windows PC, made inside a fresh Ubuntu that WSL2 runs (GitHub's Windows
# machine), as root, from the checkout wsl starts it in: the servers' own setup (setup.sh), this
# checkout's release taken by the servers' own update (alpha update), then what makes it a PC's.
# The release is signed for that update with a key made here and thrown away; afterwards the
# Linux trusts Kenil's key alone (core/config/signing-key.pub), so every later update is his.
#   sh release/windows/image.sh            (then wsl --export the distribution)
set -eu
REPO=$(pwd)
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get install -y -qq git openssl >/dev/null
git config --global --add safe.directory '*'

# the setup folder, as `pnpm server setup` makes it, trusting the throwaway key for now
SETUP=/tmp/alpha-setup
rm -rf "$SETUP" && mkdir -p "$SETUP"
for f in setup.sh alpha alpha.service verify.mjs; do cp "$REPO/release/server/$f" "$SETUP/"; done
cp "$REPO/.nvmrc" "$REPO/package.json" "$SETUP/"
openssl genpkey -algorithm ed25519 -out /root/once.pem 2>/dev/null
openssl pkey -in /root/once.pem -pubout -out "$SETUP/signing-key.pub"
sh "$SETUP/setup.sh" "" ""

# this checkout as a release, made as `pnpm server package` makes one
export PATH=/opt/alpha/node/bin:$PATH
SRC=/root/src
LIST='^(docs/|mac/|desktop/|\.data/|\.github/)'
rm -rf "$SRC" && mkdir -p "$SRC"
(cd "$REPO" && git ls-files -c | grep -Ev "$LIST" | tar -cf - -T -) | tar -xf - -C "$SRC"
cd "$SRC"
pnpm install --frozen-lockfile --silent
pnpm --filter @alpha/window build >/dev/null
VERSION=${ALPHA_VERSION:-$(git -C "$REPO" rev-parse --short HEAD)}
NAME="alpha-server-$VERSION"
(git -C "$REPO" ls-files -c | grep -Ev "$LIST"; echo window/dist) >/tmp/files
tar -czf "/tmp/$NAME.tar.gz" -T /tmp/files
node -e 'const c=require("node:crypto"),f=require("node:fs");f.writeFileSync(process.argv[2],c.sign(null,f.readFileSync(process.argv[1]),c.createPrivateKey(f.readFileSync("/root/once.pem"))).toString("base64"))' "/tmp/$NAME.tar.gz" "/tmp/$NAME.tar.gz.sig"
alpha update "/tmp/$NAME.tar.gz" "/tmp/$NAME.tar.gz.sig"
cd /

# a PC's: Kenil's key alone from now on; the key Windows keeps for the secrets; no Tailscale
install -m 644 "$REPO/core/config/signing-key.pub" /opt/alpha/signing-key.pub
mkdir -p /etc/systemd/system/alpha.service.d
install -m 644 "$REPO/release/windows/alpha-pc.conf" /etc/systemd/system/alpha.service.d/pc.conf
systemctl stop alpha 2>/dev/null || true
systemctl disable -q alpha
systemctl daemon-reload
rm -f /etc/alpha/secrets.cred
apt-get purge -y -qq tailscale tailscale-archive-keyring >/dev/null 2>&1 || true
rm -f /etc/apt/sources.list.d/tailscale.list /usr/share/keyrings/tailscale-archive-keyring.gpg
# the person's data starts empty on their PC; the Windows app writes alpha.yaml at install
find /home/alpha/data -mindepth 1 -maxdepth 1 -exec rm -rf {} +
rm -rf "$SRC" /root/once.pem /tmp/alpha-setup /tmp/alpha-server-* /tmp/files
apt-get clean
printf '%s\n' "$VERSION" >/opt/alpha/pc-version
echo "Alpha's Linux is made, on $VERSION."
