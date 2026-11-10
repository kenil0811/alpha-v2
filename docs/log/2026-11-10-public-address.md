# 10 November 2026: a public address for the server

On Kenil's word ("i want a public address, set it up"), `pnpm server address <ssh address> public`
turns on Tailscale Funnel in place of Serve: the same https address, open to the internet, with each
person still signing in. Claude Code's safety check had stopped this earlier without his word.

Checked from outside his Tailscale, through Funnel's public relay: the page loads, and the core's
routes answer 401 until someone signs in. Funnel took a few minutes to answer after it was turned on.
Funnel is on Tailscale's free plan, which is for non-commercial use, so a client's server needs a
paid plan or another way in. Sign-in has no slowing down after wrong passwords yet.
