# 23 Nov 2026: one yes and no, one copy line, small moments of feedback

Vikas asked for a standard tick and cross for yes and no, a copy icon wherever Alpha says to paste
something elsewhere, and micro-interactions across the window. `ui/yes-no.tsx` now answers a review
card's two choices, a guess's keep or empty, a pair's merge or keep apart, a waiting rule, and any
card or question whose answers are a plain Yes and No (`isYesNo`); worded or three-way answers (the
Module builder's playback, Send it, File it) keep their words. `ui/code-line.tsx` holds Alpha
Bridge's pair, lend and run commands and its link, `claude setup-token` beside the token field,
and a sign-in app's addresses and permission names. The feedback is five utilities in `app.css`
(press, swell, lift, pop, rise-in) used by the shared parts, off with reduced motion. Set up
Alpha's own screens and the interviews plugin are left to the agents working there: the Claude
chapter's step still says `claude setup-token` in its words, and Gmail's steps too. ui-rules L20,
L21 updated and L22 added, proposed; look.test holds L20.
