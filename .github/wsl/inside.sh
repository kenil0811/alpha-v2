#!/bin/sh
# Inside Alpha's Linux on a Windows machine, as root (step 1 of the Windows installer: the proof).
# The servers' own setup (release/server/setup.sh) and the servers' own update (the alpha command),
# on a release made here from this checkout and signed with a throwaway key whose public half this
# Linux trusts; nothing of Kenil's key leaves his Mac. The local Alpha's alpha.yaml is the Mac's
# shape: no sign-in (the window is on this PC alone) and a developer switch for the made-up kit.
set -eu
# wsl starts it in the checkout, as Linux sees that folder (/mnt/d/…)
REPO=$(pwd)
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get install -y -qq git openssl >/dev/null
git config --global --add safe.directory '*'

# the setup folder, as `pnpm server setup` makes it, with the throwaway key's public half
SETUP=/tmp/alpha-setup
rm -rf "$SETUP" && mkdir -p "$SETUP"
for f in setup.sh alpha alpha.service verify.mjs; do cp "$REPO/release/server/$f" "$SETUP/"; done
cp "$REPO/.nvmrc" "$REPO/package.json" "$SETUP/"
openssl genpkey -algorithm ed25519 -out /root/proof-key.pem 2>/dev/null
openssl pkey -in /root/proof-key.pem -pubout -out "$SETUP/signing-key.pub"
sh "$SETUP/setup.sh" "Proof" ""
cat >/home/alpha/data/alpha.yaml <<'YAML'
owner: "Proof"
developer: true
YAML
chown alpha:alpha /home/alpha/data/alpha.yaml

# a release of this checkout, made as `pnpm server package` makes one, on Linux's own disk
export PATH=/opt/alpha/node/bin:$PATH
SRC=/root/src
rm -rf "$SRC" && mkdir -p "$SRC"
(cd "$REPO" && git ls-files -c | grep -Ev '^(docs/|mac/|\.data/|\.github/)' | tar -cf - -T -) | tar -xf - -C "$SRC"
cd "$SRC"
pnpm install --frozen-lockfile --silent
pnpm --filter @alpha/window build >/dev/null
NAME=alpha-server-proof
(git -C "$REPO" ls-files -c | grep -Ev '^(docs/|mac/|\.data/|\.github/)'; echo window/dist) >/tmp/files
tar -czf "/tmp/$NAME.tar.gz" -T /tmp/files
node -e 'const c=require("node:crypto"),f=require("node:fs");f.writeFileSync(process.argv[2],c.sign(null,f.readFileSync(process.argv[1]),c.createPrivateKey(f.readFileSync("/root/proof-key.pem"))).toString("base64"))' "/tmp/$NAME.tar.gz" "/tmp/$NAME.tar.gz.sig"
alpha update "/tmp/$NAME.tar.gz" "/tmp/$NAME.tar.gz.sig"
alpha status
