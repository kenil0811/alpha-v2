#!/bin/sh
# For the smoke test on GitHub's machine: the start the Windows app makes (engine.rs), with a key
# made here in place of the one Windows keeps for the person: handed to a file in memory alone,
# then Alpha started, waited for until it answers.
set -eu
umask 077
mkdir -p /run/alpha
head -c 32 /dev/urandom | base64 -w0 >/run/alpha/secrets
printf 'owner: Smoke\ndeveloper: true\n' >/home/alpha/data/alpha.yaml
chown alpha:alpha /home/alpha/data/alpha.yaml
systemctl start alpha
i=0
while [ "$i" -lt 90 ]; do
  curl -fsS -o /dev/null http://127.0.0.1:4700/api/health && exit 0
  i=$((i + 1))
  sleep 1
done
echo "Alpha did not answer."
exit 1
