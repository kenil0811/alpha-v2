# 23 Nov 2026: Alpha keeps learning after setup

Vikas: "Why didn't the onboarding flow read my Edge browser history?", and the end of setup
should start regular reading, a look after three days with a few more questions, and watching the
work only where Alpha stays on and he said yes. Proposed for Kenil's review.

**Edge was read.** His Alpha Bridge (0.5.2, paired with his server) lends Browsing. Run read-only
on his Mac, the reader's own code, inside the Bridge's sandbox too, opens Edge's Default profile
(19,640 visits in 90 days, 199 sites on two days or more) beside Arc's: 413 sites, 266 of them seen
in Edge. No lock, no window, no dedupe lost it. What hid it: Get to know you never showed a
computer reader's first line (the count), and its "Most used" counted rows, one per site, so every
site scored 1 and the first five by the alphabet were shown; no line ever named a browser. Now the
first line shows with its browsers ("413 sites from Arc (316) and Edge (266)"), and most used goes
by days used (apps by times used). His local homes have no computer paired and no interviews
plugin, so nothing there read any browser. Also fixed: a browser was named by a pattern over its
whole path (a home called /Users/marcia made Chrome "Arc"); now by the folder its profiles sit in.

**Dia** (Chromium; `Dia/User Data`) is read and named; his Dia history opens the same way.
**Safari** comes later, as an offer (below).

**After setup.** Browsing and Apps read every day through the Bridge for a person who finished Set
up Alpha, only what they left on in Get to know you (`host.keepsReading`, wall in
`Plugins.keepsReading` and `ConnectorService.syncDue`); paused connections stay paused. A second
check, "A review after setup", looks daily and acts once per setup, on the first look after the
third day: only a read since that brought something new wakes the Interviewer, whose short
interview reopens What I learned; Home's row says "A few more questions from Alpha", with a Mac
notice. An agent's check is now told the tick's time (`now`).

**Watching the work** is walled (`core/src/world/observe.ts`): the person's own yes, kept with when,
switched in Settings › Permissions, and a computer of theirs with Alpha Bridge connected. The watcher
(`connectors/computer/src/observe.ts`) is a stub that refuses: it waits on Kenil.

Tests: computer readers, interviews plugin, connector service, observe, rules I5 and I6, R3. Journeys:
edge-and-dia-history-are-read passes; three-days-on-nothing-new-wakes-no-one passes every check and
fails only at the draft (Claude is not signed in on this Mac), as a-quiet-month does;
three-days-on-something-new-asks-again needs the model. Alpha Bridge needs a release for Dia and
the naming fix; not bumped.

## Asks in phases, and Safari

Vikas: "Why isn't Alpha Bridge asking Full Disk Access?… rolled out phase wise when the
prerequisites are met, rather than burdening the user upfront." An extra permission is now offered
only once its prerequisite is met, one at a time, never in Set up Alpha, as one optional Home card
with a tick (yes) and a cross (not now); a not now waits 30 days. One list, `core/config/offers.yaml`,
judged by `core/src/offers.ts` (rule I7, proposed): Safari once Safari is among the apps the Apps
reader found and Alpha Bridge is connected; watching once Alpha Bridge has been connected 7 days
since setup (counted from the later of pairing and setup while connected now; a gap in between is
not seen). Watching is given only there now; Settings › Permissions only takes it back.

Safari's yes has Alpha Bridge open System Settings at Full Disk Access (that pane only); the card
says to turn on Alpha Bridge there. The Bridge sees the grant by trying to read
`~/Library/Safari/History.db` (read-only, immutable), then lends Safari itself. The Safari reader's
sandbox names only `~/Library/Safari`; its sites land in Safari sites, read with Browsing's, through
the same never-use list, every day after setup. Not seen yet: whether the grant reaches the
reader's sandboxed child (macOS should count Alpha Bridge as the one asking); if not, its check
says the grant is missing, in those words, and it reads nothing. Alpha Bridge needs a release for
Dia, the naming fix and Safari; not bumped.
