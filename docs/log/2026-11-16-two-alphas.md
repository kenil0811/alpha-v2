# 16 Nov 2026: two Alphas on one server

Kenil wants the one server to hold Avilo's Alpha and his own for testing, sharing no data. His yes
in the step 9 doc (091dca4b): today's world stays his, Avilo's starts empty; Avilo's on its own
domain, his private on Tailscale; Avilo's on Avilo's own Claude subscription; backups on the same
disk and no heartbeat for now.

- A named Alpha (`as avilo` on `pnpm server`, `alpha avilo …` on the machine) is its own system
  user (`alpha-avilo`), home closed to other users, sealed secrets file, service, port (the next
  free one after 4700, in `/etc/alpha/ports`), release link and address. The first Alpha stays as
  it was, and every command without a name means it.
- An update never unpacks over a release another Alpha runs, and a failed one never deletes it.
- `pnpm server address <ssh> domain <name>`: Caddy in front of the Alpha with a certificate, once
  the domain points at the machine's fixed IP. A named Alpha on Tailscale is private, at the
  machine's address and its own port. Switching the first Alpha between private and public
  touches only its own 443.
- The design now says a machine may hold a few Alphas side by side.
- On one machine's address the two Alphas' sign-in cookies overwrote each other (browsers keep
  cookies by host, not port): an Alpha on another port than 4700 names its own
  (`alpha_session_4710`). Rule A6 gains the case.
- The new server (Stockholm, its own fixed IP) holds Kenil's Alpha and Avilo's (`as avilo`, port
  4710), both private on Tailscale until Avilo's domain. Nothing moves from the old server, on his
  word.
- A named Alpha can go public through Funnel, on the owner's word (`pnpm server address <ssh> as
  avilo public`): Funnel opens only 443, 8443 and 10000, so it is at the machine's address on
  8443 while the first Alpha stays private on 443. Avilo's is at it for now, to share a link
  without Tailscale; its own domain is the lasting address (Funnel's free plan is not for
  business use).
