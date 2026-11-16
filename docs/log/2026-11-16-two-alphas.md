# 16 Nov 2026: two Alphas on one server

Kenil wants the one server to hold Avilo's Alpha and his own for testing, sharing no data. His yes
in the step 9 doc (091dca4b): today's world stays his, Avilo's starts empty; Avilo's on its own
domain, his private on Tailscale; Avilo's on Avilo's own Claude subscription; backups on the same
disk and no heartbeat for now.

- A named Alpha (`--as avilo` on `pnpm server`, `alpha avilo …` on the machine) is its own system
  user (`alpha-avilo`), home closed to other users, sealed secrets file, service, port (the next
  free one after 4700, in `/etc/alpha/ports`), release link and address. The first Alpha stays as
  it was, and every command without a name means it.
- An update never unpacks over a release another Alpha runs, and a failed one never deletes it.
- `pnpm server address <ssh> domain <name>`: Caddy in front of the Alpha with a certificate, once
  the domain points at the machine's fixed IP. A named Alpha on Tailscale is private, at the
  machine's address and its own port. Switching the first Alpha between private and public
  touches only its own 443.
- The design now says a machine may hold a few Alphas side by side.
