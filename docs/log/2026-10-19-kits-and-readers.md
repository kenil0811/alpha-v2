# 19 October 2026: kits, readers and runs (the deal search kit, stage A)

Kenil said yes to the deal search plan's four choices: listings land straight in Deals with a Home
line for the ones that fit; the sources and thesis come from the Platforms CSV and the scope; Alpha
writes each source's reader when it is added; the Funnel waits for pages. And one rule: **nothing
client-specific in alpha-v2**. A client's kits live in their own private repository,
installed from a folder (design §10, `CLAUDE.md`). Stage A is the generic part,
built here; stage B is the deal search kit itself, in the client's repository.

## What was built (uncommitted, for Kenil's review)

- **Kits** (`core/src/modules/kits.ts`): a kit is a folder (`module.yaml`, `setup.yaml`, notes,
  skills, agents). Install copies its files, makes its tables, lands its setup rows as the kit's
  and leaves its agents paused; update follows the ownership rule by hash (untouched files and
  rows replaced, the person's changes kept, nothing deleted). The module folder is a git
  repository (isomorphic-git): every install, update and keep is a commit. World migration 4:
  kits, module files, kit rows, agents, runs.
- **The browser engine** (`connector-sdk/src/browser.ts`, Playwright 1.64.1): its own headless
  browser in Alpha's folder (about 200 MB), one profile per site, a person's pace (4 to 9 s,
  in `limits.yaml`), robots rules kept, and a stop at a bot check, a sign-in or a 429 with the
  reason. `extract` reads every page of a list by its next link, each item with its own id.
- **Scripts** (`core/src/scripts/`): JavaScript run by the core's Node under Anthropic's
  sandbox-runtime: no network, writes only in the module folder, the person's home unreadable.
  The script imports nothing of Alpha's; it is handed `alpha` (rows by field name, the browser,
  `tell`, `log`) over its pipes.
- **Agents and runs** (`core/src/modules/agents.ts`, `runs.ts`): an agent is a file with a
  trigger (every hour, day or week at a time; a cron; a table changing) and the script it runs.
  The scheduler runs what is due, one run of an agent at a time, paused ones never. A run is a
  row with its steps in the journal. A site not on the module's list waits on a gate 1 card; the
  yes puts it on the list for good. What a run tells the person is a line on Home.
- **The desk's tools:** `look` (a page as a person sees it; with a selector, what it finds),
  `keep` (a skill, agent, page or notes in a module, checked and committed; an agent kept here is
  on), `run` (an agent or script now, to try it).
- **The window:** Settings › Kits and agents (install from a folder, update, each agent on or
  paused, Run now) and Activity (every run with its steps, Stop).

## Tried

On a scratch copy with a made-up kit (Bakery, `core/src/modules/test-kit`): the kit installed,
its agent ran from Settings, Activity showed it. Asked for an hourly agent, Alpha made a table,
kept a skill and an agent, and ran it. Its first try failed: a script read rows keyed by field
slug (`name`) while it landed them by field name (`Name`), and the model wrote a debugging script
into the module to find out, then invented an `alpha://` link as a row's source. Fixed in the
mechanism: rows reach scripts by field name, and a row's url must be a web link (a wall). Asked
again on a fresh copy, it worked first time with no helper left behind.

Asked for a reader of a made-up two-page list served on this Mac, Alpha looked at the page,
kept the reader and its agent, and its try stopped on the card for the site; after the yes it
ran, failed once on `extract`'s shape (the tool's notes now say it returns `{ pages, items }`),
fixed its script and read all three firms. That flow is now the journey `a-reader-for-a-list`.

## Stage B: the deal search kit (in the client's repository), and what it needed here

Kenil, 22:32 UTC: the client's repository is a separate private one holding only the client's kits and
journeys, no alpha-v2 code. It is made beside alpha-v2 and goes to GitHub after his review.
The client's two journeys and their reports moved there.

What the kit needed from the platform, each generic:

- An agent's `runs.input` (one listing reader, each source's agent giving it the page) and a
  `changes` trigger over several tables; agents waiting on a change run soon after it.
- Setup values marked assumed, with what they rest on (the thesis's financing).
- **What the person said stands:** a landing (a connection, a reader) or a script's figures never
  write over a stated value. A wall in `records.land` and the runner's `rows.compute`.
- A stated value may cite the card the person answered (a wall: the card must have their answer).
- A run's line on Home may name rows, each with Open and one choice (Pass); a choice set in the
  window is the person's word. A board view for a table with a choice; relations shown by name;
  one-line table rows; amounts as $900,000.
- A problem's kind reaches a script (a reader marks its source Needs your sign-in or Blocked).
- The journeys runner: `--from` a client's folder, a `kit` step, a `site` step, a `due` tick, and
  checks on questions, a row's field and what was told.

The first the deal search kit journey run failed usefully: the model read only the list (so staff and
bookkeeping share were unknown and nothing fitted), could not cite the Add card as the source of
On (so it marked it assumed after seven tries), and a deal two brokers list flipped its name
between them on each read. Fixed in the kit's notes, the platform (cards citable) and the reader
(the first source keeps the deal's name and figures). The second run passed: two made-up
brokers added on cards, four deals with the shared one merged, HP101 and SB201 fit, Home told it.
In the window, on a scratch copy: Pass on Home moved the deal, the board shows it, each figure
opens to its formula and the financing shows as assumed.

## Left

- Kenil's review of both stages; then commits here and the client repository's first commit and push.
- A real source, on Kenil's word: the readers have only read made-up sites.
- The Funnel waits for pages; CIM economics, call guides, the deal analyst and the 18 tracker
  deals wait for the full workbook, as agreed.
