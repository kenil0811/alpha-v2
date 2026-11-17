# 17 Nov 2026: Bridge step 4, the browser on the computer

Kenil's calls on doc CE9YhfMqra7VsJHVWjAruc: Chrome only ("lets just keep chrome for now, no need
for edge"); a step when the computer is off answers at once; Google, LinkedIn and a site whose
server sign-in fails twice move to the computer; signing in starts from Alpha.

- Tried first on his Mac: Chrome started with `--remote-debugging-pipe`, its messages relayed
  through a local websocket, driven by Playwright's `connectOverCDP`, a page read and its
  screencast frames received. So nothing on the computer listens, and the core's browser code,
  Watch and Take over need no change.
- Alpha Bridge 0.4.0: a Browser switch in its menu (and `alpha-bridge browser on|off`), off until
  turned on and refused without Chrome. Asked by Alpha, it opens a site in a normal Chrome window
  of the site's own profile in its folder; closing the window lends the site. It drives only a
  site it lends, with the switch on and not paused, and a pipe ends when either does.
- The core: `bridge/cdp.ts` (the loopback relay, one key per use), `bridge/sites.ts` (where a
  person signs in to a site: here, or their computer, or words for what is missing), the browser's
  `OnComputer` hook and markers (`.on-computer` with the computer and the site's own name; `.moves.json`
  for sign-ins that failed on the server). The hub carries sign-ins, the switch and the pipe.
  `core/config/sites.yaml` lists the sites and the tries.
- The window: Sites says which computer a site was signed in to on; a card's and Sites' Sign in say
  the window is open on that computer; a computer's page lists its sites with Sign out.
- Test: a made-up site on this machine, Playwright's browser standing in for the computer's Chrome;
  signed in there, read by the core through the relay, refused for another person (B1) and for a
  site not lent (B2), and "Test Mac is off now" once the computer stops.

Later, from Kenil's first try (his server Alpha had no Claude token, and the Chief of staff replied
Claude Code's own "Not logged in · Please run /login"): a turn Claude refuses for this install now
fails in Alpha's words, read from the error Claude Code names on its message (signed out, a refused
key or token, billing, an account on hold) and how the session was started. The owner gets a link,
Open Settings › Model; a member is told the firm's owner fixes it there. A one-question ask says
the same. Seen on the server first: the refusal comes as a "success" with `is_error`, no text
streamed.

Then, with the token in, the Chief of staff answered that Drive had no connection and never tried
the browser: nothing told it which sites the person is signed in to. On his yes, every session now
starts with a Sites part: each site the person signed in to in Alpha's browser, the computer it
lives on when it is one, and that browse reaches them for what no connection reads; with none, that
the person signs in from Intelligence › Connections › Sites. A sign-in later in a session already
reaches it as the yes on its card.
On his next yes, the sites are part of a session's fingerprint: once they change, a kept session is
not resumed and a live one (the Chief of staff's too) closes before its next turn, so the chat
starts again handed what was said, knowing the sites. With no sites the fingerprint is as before.
