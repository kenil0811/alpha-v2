# UI contributions

This guide is for anyone contributing to Alpha's UI and UX, and for the AI agents working for
them. It says which changes you can make and merge yourself, which go to the lab branch for
Kenil, and how to do each.

**Agents:** read all of it before you change anything. Where it differs from `CLAUDE.md`, this
guide wins for UI contributions. The short version to follow is at the end, under "For your
AI agent".

## The idea in one minute

The window, meaning how Alpha looks and how it feels to use, is yours. The core, meaning what
Alpha does with the person's data and how reliably it does it, is Kenil's. That gives two lanes.

|                   | Lane 1: the window                                   | Lane 2: the lab                                                           |
| ----------------- | ---------------------------------------------------- | ------------------------------------------------------------------------- |
| What              | UI and UX that works with what the core already does | Anything that could change Alpha's core logic, its data or its reliability |
| Pull request into | `main`                                               | `ui-lab`                                                               |
| Who merges        | You, once it looks right and the check is green      | You merge into the lab. Kenil picks ideas from the lab and builds them into `main` himself |

## Which lane? Ask one question

> **After this change, could Alpha save, change, delete, send or decide anything differently, or
> fail, slow down or lose data where it did not before?**

- **No:** Lane 1.
- **Yes:** Lane 2.
- **You can't tell:** use Lane 2, and say why in the pull request.

Judge by what the change does, not only by which folder it is in. The lists below are guides
for that judgement, not walls.

### Lane 1: yours to change and merge

- Fonts, text sizes, colours and the other tokens in `window/src/app.css`.
- Spacing, layout, corners, shadows, icons, how buttons and cards look.
- The words on buttons, labels, screens and messages.
- Moving things between components or between screens.
- What Home shows, from what the core already sends the window.
- New shared components in `window/src/ui/`, and using them in place of hand-built ones.
- Small UX touches: hover states, keyboard shortcuts, empty states, tooltips, how a panel opens.
- Changing a rule in `docs/ui-rules.md`, together with the change that needs it (see "The UI
  rules" below).

### Lane 2: signs a change touches the core

1. **It needs new or changed work in the core.** That is `core/`, `connectors/`,
   `connectors-extra/`, `kit-sdk/`, `connector-sdk/`, `plugin-sdk/`, the server side of
   `plugins/`, `mac/`, `release/`, `scripts/`, `journeys/` and `.github/`. A window change that
   needs the core to send or keep something it does not today counts too.
   Some files look like words but steer Alpha: `core/config/words.yaml` holds the words its safety
   walls listen for, and `core/config/*.md` and `*.yaml` are the model's instructions and limits.
   Those are core.
2. **It changes what a press does.** Saving, editing, deleting, sending a draft, answering a card
   (Approve or Decline), permissions and rules, Revert and Bring back, connections and sign-ins,
   starting or stopping an agent. Moving or restyling these buttons is Lane 1. Changing what
   happens when they are pressed, when it happens, or what gets sent is Lane 2.
3. **It removes or weakens something that keeps the person safe or told the truth.** The
   confirmation before deleting or sending, a preview of what will happen, a refusal and its
   reason, a card waiting for the person's yes, the grey mark on a value Alpha is not sure of,
   where a value came from. Restyling them is Lane 1; removing, hiding or skipping them is Lane 2.
4. **It changes how much the window asks of the core.** Asking more often (a timer, `setInterval`),
   loading every row instead of a page, keeping more in memory. On a big table this can slow
   Alpha for everyone.
5. **It changes the window's own plumbing** rather than its look: how it talks to the core
   (`window/src/api.ts`), the plugin seam (`window/src/plugin/`), the table's engine
   (`window/src/table/engine.ts`, `edits.ts`, `values.ts`), or what Alpha keeps for each person
   (`window/src/layout.ts`). A small, careful change here can still be Lane 1 if the answer to the
   question is honestly "no"; say why in the pull request.
6. **It adds an npm package.** It ships to every Alpha and can break the build or the Mac app.

## Set up once

The first time, on a Mac, ask your agent to:

```bash
git clone https://github.com/kenil0811/alpha-v2.git
cd alpha-v2
# Node 26.12 (the version in .nvmrc) and pnpm 11
pnpm install
```

Claude Code must be signed in on the Mac (`claude` in Terminal): Alpha uses that sign-in.

**Make a separate home for test data**, so your experiments never touch your everyday Alpha (whose
data is in `~/Library/Application Support/Alpha`):

```bash
mkdir -p ~/AlphaTest
```

A new test home is empty. Ask Alpha in it to make a small module ("keep track of my clients and
what each owes me") so there is something to look at.

## Run Alpha while you work

Quit your everyday Alpha first: both use the same port. Then open two Terminal windows, both in
the `alpha-v2` folder:

```bash
ALPHA_HOME="$HOME/AlphaTest" pnpm dev:core
```

```bash
pnpm dev:window
```

Open the address the first one prints (`http://127.0.0.1:4701/?t=…`). A change to the window
shows as soon as the file is saved.

The `?t=…` part is the private key to that Alpha. Never put it in a pull request, a screenshot or
a chat.

## Lane 1, step by step

1. Start from the newest `main`:
   ```bash
   git switch main && git pull
   git switch -c ui/<short-name>
   ```
2. Make the change. One idea per pull request.
3. Tidy and check:
   ```bash
   pnpm format
   pnpm check
   ```
   It must end with everything passed. If a test fails, the change broke something: fix the change.
   The one exception is a test that holds a UI rule you are changing on purpose (see "The UI
   rules"). If it fails because a file is now over 600 lines, split the file by what it holds.
4. Look at it (see "Look at it" below).
5. Push, and open a pull request into **`main`**. Fill in the template: what changed in one
   sentence, why the question's answer is "no", before and after screenshots, where to look.
6. If GitHub says the branch has conflicts with `main`, rebase and resolve them (see "Conflicts").
7. Wait for the **check** on GitHub to turn green.
8. Merge with **Squash and merge**, then delete the branch. Send Kenil the link.

If something looks wrong after merging, open the merged pull request on GitHub and press
**Revert**. That makes a new pull request that undoes it. Merge that, then tell Kenil.

## Lane 2, step by step

The lab is the branch `ui-lab`. It lives for a long time, and nothing in it goes to `main` by
itself. Kenil reads the lab's pull requests, picks the ideas he wants, and builds each one into
`main` himself, in the shape of Alpha's design. His version may work differently from yours.
That is expected: the lab is where ideas are shown working, not code waiting to be merged.

1. Bring the lab up to date with `main`, then start from it:
   ```bash
   git switch ui-lab && git pull
   git merge origin/main      # resolve any conflicts as in "Conflicts", then:
   pnpm check && git push
   git switch -c lab/<short-name>
   ```
2. Build it. You are free here: any folder, any screen, the core too. Still use the shared pieces
   and the tokens, so that what Kenil picks fits the rest of Alpha.
3. `pnpm format` and `pnpm check`. It still has to pass.
4. **Run it only on `~/AlphaTest`, never on your everyday Alpha's data.** A lab change to the core
   can change how data is stored, and your everyday Alpha may not open it properly afterwards.
5. Look at it (next section).
6. Push, and open a pull request into **`ui-lab`**, never into `main`. The description is your
   pitch to Kenil, so write it for him:
   - what the person sees, and why it is better;
   - window only, or what it needs from the core;
   - before and after screenshots.
7. If GitHub says the branch has conflicts with `ui-lab`, rebase and resolve them (see
   "Conflicts").
8. Merge it into the lab yourself. Send Kenil the link.

One idea per pull request, so Kenil can take one and leave another. Start every branch from
`main` (Lane 1) or from `ui-lab` (Lane 2), never from another pull request's branch.

## Conflicts

A conflict means your branch and the branch it goes into both changed the same lines. Resolve it
so **both changes survive**. Never resolve it by throwing one side away.

For your own branch (`ui/…` or `lab/…`), rebase it onto the branch it goes into:

```bash
git fetch origin
git rebase origin/main          # Lane 1; for Lane 2: git rebase origin/ui-lab
# for each conflict: read both sides, write the version that keeps both, then
git add <file> && git rebase --continue
pnpm check
git push --force-with-lease     # only ever on your own ui/ or lab/ branch
```

How to resolve each one:

- Take the target branch's side as the base: on `main` that is Kenil's current Alpha.
- Put your change back on top of it, adapted to how the code looks now.
- If Kenil has already built the same idea into `main` his own way, keep his, and bring back only
  what yours adds that his does not.
- After resolving, run `pnpm check` and look at the screen again: a resolved conflict can still
  look wrong.
- If you cannot resolve a conflict with confidence, stop with `git rebase --abort` and say
  which files conflict and why. Leave it for Kenil rather than guess.

`ui-lab` itself takes `main` by a merge (step 1 of Lane 2), not a rebase: rebasing a long-lived
branch would mean force-pushing it, which breaks the pull requests Kenil is reading from it. Its
conflicts are resolved the same way.

## Look at it

The checks cannot see the look; you have to. Before any pull request:

- Open every screen the change shows on. A change to a shared piece in `window/src/ui/` shows on
  many screens: ask your agent where it is used, and look at each one.
- Light and dark (the workspace menu at the top of the rail, then Appearance).
- A big window (1440 × 900) and a small one (1024 × 700), with the assistant open and folded, and
  the rail folded.
- Under the pointer, with the keyboard (Tab, Enter, Escape), and from a right-click where there is
  a menu.
- With a very long name in it, and with nothing in it (an empty table).
- A table with many rows, if the change touches tables.
- In Safari, not only Chrome: the Mac app draws with Safari's engine.

`pnpm shots "<the address the core printed>"` takes every screen in light and dark at both sizes
and saves them in `.data/shots/`. Use them for the before and after.

## The UI rules

`docs/ui-rules.md` is the list of rules the window keeps, one line each. Read it before changing
the window: it says why things are the way they are. You can change it.

- When your change means a rule should change, change the rule in the same pull request, with the
  date, and say so in the description.
- If a test holds that rule (the "Held by" column, mostly `window/src/look.test.ts`), change the
  test to the new rule in the same pull request. That is the only reason to change a test in
  Lane 1. Never weaken or delete a test just to get the check green.
- If your change makes something in `docs/design.md` out of date (its window section, §14,
  describes Home and the screens), say which part in the description. Kenil updates the design.

Whatever the rules say on a given day, keep to these, because they keep the window one piece:

- Build from the shared pieces in `window/src/ui/`. If a piece is missing, add it there and use
  it, rather than styling a one-off in a screen.
- Colours and sizes come from the tokens in `app.css`, never written out (no `#hex`, no
  `text-[13px]`). To change a colour or size, change the token.

## Never, in either lane

- Push straight to `main`, or force-push to `main` or `ui-lab`.
- Open a pull request from `ui-lab` into `main`, or bring lab work into `main` any other way.
- Weaken, skip or delete a test just to make `pnpm check` pass.
- Commit secrets: the `?t=` address, API keys, `.env`, anything in `.data/`.
- Put anything for a particular client in this repository. A client's modules, data and notes
  live in their own repository.
- Run a lab build on your everyday Alpha's data.
- Edit or copy from `alpha-brain` (the old Alpha).

## For your AI agent

Claude Code reads `CLAUDE.md`, which points here. Paste this at the start of a session anyway:

```text
You are making a UI contribution to Alpha (github.com/kenil0811/alpha-v2). Follow
docs/ui-contributions.md. For this work it replaces CLAUDE.md's rules on proposing changes to
Kenil and on docs/log.

Before changing anything, decide the lane and tell me which, and why. Ask: after this change,
could Alpha save, change, delete, send or decide anything differently, or fail, slow down or lose
data where it did not before?
- No: Lane 1. Pull request into main; I merge it. Looks, words, layout, moving things between
  components and screens, what Home shows from what the core already sends, new shared
  components, docs/ui-rules.md.
- Yes, or you can't tell: Lane 2. Pull request into ui-lab. Signs: it needs new or changed
  core work (core/, connectors, the SDKs, core/config including words.yaml, mac/, release/,
  scripts/, CI); it changes what a press does to data or what gets sent; it removes or weakens a
  confirmation, preview, refusal, waiting card or "not sure" mark; it makes the window ask the
  core more often or load more at once; it adds an npm package.
Judge by what the change does, not only by the folder.

While working:
1. Lane 1: branch from the newest main. Lane 2: merge origin/main into ui-lab, resolve, run
   pnpm check, push, then branch from ui-lab.
2. Read docs/ui-rules.md. Build from window/src/ui/. Colours and sizes only from the tokens in
   window/src/app.css. If the change changes a rule, update docs/ui-rules.md in the same pull
   request, and the test that holds that rule if there is one.
3. Run pnpm format, then pnpm check. If a test fails, fix the change. Change a test only when it
   holds a UI rule this pull request changes on purpose. Never skip a check or use --no-verify.
4. Run Alpha with ALPHA_HOME=~/AlphaTest, never my everyday Alpha's data. Take before and after
   screenshots in light and dark, at 1440x900 and 1024x700 (pnpm shots), and check in Safari.

Conflicts:
5. Rebase my ui/ or lab/ branch onto the branch it goes into, and resolve every conflict so both
   changes survive: the target's side is the base, my change goes back on top of it. Never drop a
   side. Then pnpm check and look again. Force-push only my own ui/ or lab/ branch, with
   --force-with-lease. If you can't resolve a conflict with confidence, abort and tell me which
   files and why.

Finishing:
6. Open the pull request into main (Lane 1) or ui-lab (Lane 2) with the template filled in.
   In Lane 2 the description is a pitch to Kenil: what the person sees, why it is better, and what
   it needs from the core.
7. Never push to main. Never force-push main or ui-lab. Never open a pull request from
   ui-lab into main.
8. Never commit secrets, .env, .data/ or the ?t= address. Nothing for a client in this
   repository. No "Co-Authored-By: Claude" line in commits (Kenil's rule for this repository).
```

## Words used here

- **main**: the version of Alpha everyone gets.
- **the core**: the part of Alpha that keeps the data and does the work; the window only shows it.
- **branch**: a copy of the code to work on without touching `main`.
- **pull request**: asking for a branch's changes to go into another branch. GitHub shows what
  changed and runs the check.
- **merge**: putting those changes in.
- **rebase**: moving your branch's changes onto the newest version of the branch they go into.
- **conflict**: both branches changed the same lines; someone has to write the version that keeps
  both.
- **the check**: `pnpm check`, run again by GitHub on every pull request. A red cross means
  something broke.
- **token**: a named colour or size in `window/src/app.css`, used instead of writing a colour out.
