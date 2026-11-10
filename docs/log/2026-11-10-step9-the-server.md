# 10 November 2026: clean base step 9, the server shape

Detail and Kenil's calls: https://claude.ai/artifact/6EosgFnFrptQydRFx8fGgA.

- A server is one Linux virtual machine per firm. `pnpm server setup` makes one from the Mac, `package`
  signs a release, `update` sends it (only when pressed), `link` opens the owner's one-time link, and
  `address` brings up Tailscale. Nothing there prints a secret or a link.
- A release that does not start goes back by itself, and the failed one is deleted so a later rollback
  cannot land on it.
- Secrets are one AES-256-GCM file beside the world. Its key is sealed to the machine with
  systemd-creds, and a copy is in Kenil's Keychain.
- Claude comes as a subscription token from `claude setup-token`, entered in Settings › Model. That is
  for while Kenil alone uses the server: a firm's own API key before anyone at a firm signs in.
- A site's sign-in is a live picture of the server's browser in the window. The person clicks and types
  there, Alpha never holds the password, it closes by itself once they are in, and the schedule runs again.

Changed from the detail: the address is private (Tailscale Serve, only Kenil's own signed-in devices),
not public (Funnel). Claude Code's safety check stopped the public tunnel, and a public address is on the
list for before the first client, with off-site backups and a heartbeat.

On Kenil's yes, setup turns off Ubuntu's `bwrap-userns-restrict` AppArmor profile and
`kernel.apparmor_restrict_unprivileged_userns`. With them on, Anthropic's sandbox cannot start on Ubuntu
26.04, so connectors did not load. That trades one extra Ubuntu layer against kernel bugs for the full
sandbox, on a machine that runs only Alpha.

Found by running it on the server:

- A Mac's tar added 631 `._` files to a release. Every tar on the Mac now leaves them out.
- A pack could not be installed, because a server's temporary folder is its own disk (EXDEV). Packs now
  unpack beside where they go.
- `public_address` was written but never read, so links used 127.0.0.1.
- The journeys runner never exited on Linux and could not use a token. Both fixed.
- The model on the server often skipped keeping a module's schedule as a file. The `schedule` tool now
  says that is the way, and revert-a-run went from 1 of 3 to 3 of 3.

Found by trying the live window in WebKit: a re-render behind it reopened the site again and again, and
one of those could close the reader's page. It now opens once, and only follows pages its own pages opened.

Checked on the server, on the release he looked at: 28 of 31 journeys passed in
`docs/journeys/2026-11-10-1923-summary.md`. a-mirror-change-is-a-request waits for Dell's contract.
a-reader-for-a-list failed once, the model waiting for the site's yes before keeping the schedule, and
passed 2 of 3 again (`1925` summary). a-scheduled-run-has-nothing-to-say failed every time there and
passed 4 of 4 on the Mac: on the server the model writes a check that stays asleep, which also says
nothing, but the journey counts only a run that closes itself. A connector was refused a site it does
not name. Killed, Alpha was back in 8 seconds. A deliberately broken release went back by itself. The
live picture, typing and noticing the sign-in worked on the server's own browser, and the window on the
Mac in WebKit, on a made-up site.

Found on his look: his sign-in worked, but the run after it stopped because Alpha had kept the schedule
without naming Deals in `touches`, and it could not try the script behind the sign-in to see that.
On his yes, a schedule's file that names no tables now writes its own module's tables, as a try
from the chat does; `touches` only narrows it, and a write still never leaves the module. (A check
of the script's text came first and missed a table named in a variable.) Before his sign-in, a "did not finish 2 times" card had also appeared. A run that ends on the person's card
(a sign-in, a site to allow) is now waiting, not failing, and the schedule does not run again until
the card is answered. The site-to-allow card names its run, so the run goes again on its yes with no
Try again. In WebKit on the Mac, from an empty Alpha: allow, sign in, the window closes by itself in
about a second, no failure card, and both deals land.
