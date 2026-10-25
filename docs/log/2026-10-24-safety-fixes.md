# 24 October 2026: the problems list, step A (items 1 to 6)

From the review https://claude.ai/artifact/UT8qRdXRNAhMVd8TSCdgLM of Vikas's problems list;
Kenil's word 20:39 UTC ("lets start with these fixes"), on a branch (`safety-fixes`, a worktree
beside the repo) so the running prompt measurement was not touched; the history rewrite for item
8 dropped on his word 20:38 ("leave the commits").

1. **Websites controlling a running Alpha** (`api/server.ts`): the token, Host and Origin check
   went by the raw address, and Fastify decodes `%61` before routing, so `/%61pi/me` was
   `/api/me` unchecked. The check now goes by the route reached (`req.routeOptions.url`) and
   the decoded path; a test tries `/%61pi/me`, `/%77s`, `/api/%6de` and a POST to
   `/%61pi/kits/pack`.
2. **A tampered pack emptying a folder** (`modules/packs.ts`): a pack's version was joined into
   a path and that folder removed. A version must be `1.2.3`, the name must have a letter, both
   checked before any folder is touched; a link inside a pack is refused. Tests with a version
   of `../../Documents` (the folder untouched) and a packed symlink.
3. **An emailed attachment running as Alpha** (`api/routes/files.ts`): a stored file was served
   inline with the type its sender gave. PDF, images, text, CSV and Markdown show inline; HTML,
   SVG and XHTML under `Content-Security-Policy: sandbox` with no referrer; everything else
   downloads; `X-Content-Type-Options: nosniff` on every file. A test for each kind.
4. **A module page sending its figures out** (`window/index.html`): `frame-src 'self'` on the
   window, so a page's frame cannot navigate itself elsewhere; a `srcdoc` frame still loads.
5. **A module page speaking for the owner** (`window/src/PageView.tsx`): a page's `say` no
   longer posts to the desk by itself; the window shows "This page asks Alpha: …" above the
   frame with Not now and Ask Alpha, and sends only on that button.
6. **A Gmail hiccup shutting Alpha down** (`connectors/gmail/src/index.ts`): `withImapClient`
   listens for the client's `error` and fails that call with it; the core's restart stays the
   backstop. A test with a stand-in client that drops mid-call.

Item 8, the files only: the client's figures moved from `docs/log/2026-10-20-accounting.md` to
alpha-avilo's log; the two comments that named a client's domain use an invented one.

Found while checking the fixes on Kenil's Alpha (its log): a start that had orphan runs to end
crashed on `ReferenceError: Cannot access 'engine' before initialization` (the runner's `notify`
in `main.ts` reached the engine, made after the runner; `endOrphans` runs in the runner's
constructor since 23 Oct) and restarted itself until the orphans were gone, eight times today.
`notify` now tells the engine only once it exists.

Kenil's "looks good" 21:05 UTC: pushed, tagged v0.5.1.

## Steps B and C, on Kenil's "all the other parts at once" (21:05 UTC)

- **B, runs and sends happen once** (items 9 and 10): `runAgent` refuses a second run of an
  agent while one is going, for every caller, and refuses a paused agent unless the call says the
  person asked for it now (`asked: true`: Run now in Settings, the desk's `run` tool, a kit's own
  tests); the scheduler, a task's start, the follow-up after a draft is decided and the rerun
  after a sign-in pass nothing, so a paused agent stays paused there. `Drafts.send` keeps the
  cards being sent in a set: a second Send it on one is turned away in words, and a send that
  fails leaves the card waiting. Tests in `runs.test.ts` and `drafts.test.ts`.
- **C, Always knows the recipient** (item 7, Kenil's rule of 24 Oct): under a standing
  permission a draft goes at once only to an address that agent's kind of message has gone to
  before (the journal's `draft_decided` lines, sent, by agent, module, kind and address); a new
  recipient opens a card saying "a new recipient", with no Always offered on it, and once sent to
  on that card the address goes at once from then on. Test in `drafts.test.ts`; alpha-avilo's
  `dealpilot-outreach` journey gained the new-recipient step and a known-address step.
- **D** was done with step A (the files only).

The release workflow's first run, on the v0.5.1 tag: green in 9 minutes on macos-15,
`Alpha-0.5.1.dmg` on https://github.com/kenil0811/alpha-v2/releases/tag/v0.5.1 (the generic
build; Avilo's build with its kits is made from alpha-avilo, as 0.5.0 was).

Kenil's "looks good" 22:03 UTC on steps B and C: pushed. Steps A to D of the problems list done.

# 25 October: batch 2 (items 11 to 18 and 25)

Plan https://claude.ai/artifact/Agke9YSBRFSwHJtExTtL6W, Kenil's "yes sart" 12:07 UTC, on his
picks in the batch 2 review (https://claude.ai/artifact/FApSQP7bE3WdXaxM8Ermb9; 21 parked).

- **E1, runs part 2.** 14: `runScript`'s throw is caught in `runner.ts` and ends the run as
  failed with its words; `scripts/run.ts` forgets a sandbox start that failed. 15: the agents'
  lane (`runner.startDue`): the minute tick starts the due runs and goes on; a tick while they
  run leaves them alone. 16: `due.ts` moves an agent's cursor and last-run time only after an ok
  run (the runner too sets last-run only on ok); a failed run counts, and at `run_retries`
  (limits.yaml, 3) a card asks Try again (`runner.retry`: the count reset, one run now) or Leave
  it (`runner.leave`: the cursor and last-run moved past); the cards route answers it
  (`RUN_AGAIN`). Tests: a sandbox-down run (the script runner stubbed), three failures then the
  card, the lane.
- **E2, walls.** 11: `askedFor` needs a removal word from `core/config/words.yaml` in the quote,
  and the quote in the message typed this turn; the journey `remove-the-eggs`. 12 (stopgap):
  `module.yaml` is denied to scripts in the sandbox and to the desk's Write and Edit
  (`fileWall` in `engine/desk.ts`, now a function with a test).
- **E3, backups.** `backups.ts` `mirror(beside, dir)`: the files by hash copied once each, the
  modules refreshed whole, beside the daily world; the copy folder gets the same three
  (`copyNewestBackup`); `install.sh` stops an update whose backup failed; `alpha restore` refuses
  while the core answers. Test for the mirror.
- **E4, people.** `role_addresses` in `people.yaml`: a role address is a soft key kept in the
  row's `said.soft.email`, never in `people_keys`; a phone held by a row of plainly another name
  (`otherName` in `keys.ts`: first and last words, one starting the other is one name) is not
  merged on; both put the pair on the match card (`noteShared` in `matching.ts`, why "the same
  address" / "the same phone"). `notThis(person, record)`: the row leaves with the keys it alone
  brought as its own person, kept apart; `POST /api/people/:id/not`, Not this person on the
  person's page rows. Tests in `people.test.ts`.
- **alpha-avilo.** 13: the exports reader reads only sheets on an Accounting row or on no row
  (Accounting 0.3.2); no journey covers a sheet on a deal yet, since no journey installs both
  kits (a later one). 18: `exports-in-a-folder` and `pdf-with-places` on invented inputs
  (`fixtures/files/lakeside`, `fixtures/files/lakeside-statements`: a two-page balance sheet
  printed from HTML with Alpha's own browser); `dealpilot-deal-documents` on an invented CIM
  (`fixtures/files/harbor`): filed on a deal, read into Financials, Service mix and Staff,
  Figures taking the actual year.
- The new `dealpilot-deal-documents` journey caught a kit bug on its first run: Figures writes
  each condition's Rules you out and Why, but its file said `touches: [Deals]`, so the wall
  refused it once a CIM had landed conditions (it never had before: no journey filed a CIM).
  DealPilot 0.5.3: `touches: [Deals, Conditions]`.

Kenil's "yes push" 25 Oct 13:11 UTC on batch 2: pushed. Items 1 to 18 and 25 of the problems list done; 21 parked.

## Batch 3 (items 28 to 43), 25 Oct

Plan https://claude.ai/artifact/7AyskW9VaGjDdYeMTGUnFn, Kenil's "yes" 13:36 UTC, on his picks in
the batch 3 review (https://claude.ai/artifact/BkkgKPE3fMEV15uvLJxP9i): 28, 29, 30, 39, 40, 41,
42, 43 done; 37 the design matched to the build; 26 dropped.

- **F, the window.** 28: Disconnect (naming the connector and account), Remove the view (inside
  its menu) and Forget ask on the page first. 29: `window/src/ui/act.tsx` (`useAct`, `Refusal`):
  the control busy, the refusal's words kept beside it, the screen loaded again; Kits, Module,
  Board, Conversation's Pass, Settings (appearance, connections, a connector's removal) and the
  page's ask use it. Run now's route dropped the core's refusal too: `runner.refuseRun` (the
  busy and paused checks, shared with `runAgent`) now answers it at once; a paused agent still
  runs on Run now, as designed. 30: `NOT_ANSWERING` and `wordsOf` in `api.ts` ("Alpha isn't answering on
  this Mac right now." for a core that gave no words, never the browser's "Load failed"); Home's
  three parts load on opening and say "This didn't load." with Try again; "Nothing waits on
  you" and the rail's "Modules appear here" wait until something has loaded. Looked at in WebKit
  on Kenil's Alpha at 1240×820 and 1100×560, light and dark (`.data/shots/batch-3`), with every
  removal call blocked in that browser.
- **G, approvals.** 39: `useYes(call, yes_hours)` (limits.yaml, 6): an older yes is marked
  `lapsed_at` (migration 20) with a `card_lapsed` line, and the call asks again; `resumeRuns` in
  `due.ts`: an agent's run that ended on a permission card of its own (not a draft, not the
  desk's) goes again at the next tick once the person said yes; the desk's send cards say "a new
  recipient" when `cards.approvedTo` finds no yes or sent draft to that address. 40: `writable`
  refuses a table outside the module whatever `touches` says; `wallsForTry`: a try from the desk
  writes its module's tables and reads those and its kit's uses (its effects stay with the
  cards). 41: `answerDraft` sends only on Send it, other words hold it as the reason; the desk
  hears only cards with a turn; the task tool refuses done on an agent's task.
- **H, kits and release.** 42: `setTones` takes a ctx and journals who set the colours;
  `tonesSetByOthers` keeps them through a kit update. No screen or tool changes a colour today,
  so this guards the next one. `installPack` refuses an older pack with words (the inbox sets it
  aside). 43: `release.ts` writes MANIFEST after install.sh, the kits and the connector packs are
  in (their hashes listed too), with one seal and its verify after; `install.sh` waits on
  `ALPHA_PORT`, else alpha.yaml's port, else 4700. Not run: the next release checks both.
- **37.** Design §12: what an agent pulls in lands at once, marked with its source, never over
  the person's stated value; judgement calls go to the person as rows put to them.
- Tests: the lapse (gates), a run again on a yes (runs), the new recipient on the desk's send
  card (gate), a try's walls and a write kept in its module (walls), the draft held on other
  words and the desk told only of its own cards (engine), done refused on an agent's task (task
  tool), colours kept through an update (kits), an older pack refused (packs).

Kenil's "ok looks good" 25 Oct 14:07 UTC on batch 3's test steps: committed and pushed.
