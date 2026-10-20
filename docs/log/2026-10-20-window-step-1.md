# 20 October 2026: the window redesign, steps 1 to 7 (look, parts, shell, Home, tables, Activity, Settings)

Kenil tested DealPilot on a test copy ("looks good!") and stages A and B were committed and
pushed (alpha-v2 3937316..9cbabb6; alpha-avilo private at github.com/kenil0811/alpha-avilo). He
picked direction A, "Ledger", for the window (the design thread's proposal and mock) and said yes
to step 1 of its order of work.

## Built (uncommitted, for Kenil's review)

- **Tokens:** the proposal's `tokens.css` is `window/src/app.css`. Slate neutrals leaning to one
  slate-blue accent; green, amber and red only for states; seven text sizes (11 to 26px); light
  and dark by the Mac's setting, or `data-theme` once Settings › Appearance sets it (step 7).
  Tailwind's own palette and sizes are off.
- **Fonts, bundled:** Geist, Geist Mono and Source Serif 4 (titles only) from Fontsource 5.3.
- **Every screen on the tokens:** about 160 classes in 9 files moved by one mapping (greys to
  ink, line, sunk and hover; red and amber to bad and warn; the rail to its own tokens; the
  primary button to the accent). Sizes kept their pixels (old 12px is `text-sm`, 14px is
  `text-base`); steps 2 and 3 restyle the parts and the shell.
- **The guard:** `window/src/look.test.ts` fails any colour of Tailwind's palette, any invented
  text size or colour (`text-[15px]`, `border-[#fff]`) and any colour written out, with file and
  line. Checked on a planted offender.
- **`pnpm shots "<address>"`:** every screen (Home, Activity, Settings, each table and its board)
  in light and dark at 1440×900 and 1024×700, in WebKit (79 MB, once, in `.data/browsers`), into
  `.data/shots/<time>/`. Each screen loads fresh; opening another table now opens it as a table.

## Seen

36 shots of the test copy, which Kenil had used: he added POE Advisors, a real source, and its
46 listings came in. Light and dark both read; tables, the board, Settings and Activity keep
their layout in the new palette and type.

Noticed in his run, for DealPilot later: some POE listings say Acquisition Pending or On Hold on
the site and are kept as Listed, since the reader does not read a listing's status yet.

## Step 2: the parts (uncommitted, for Kenil's review)

Kenil said yes; step 1 was committed and pushed (c640718..0f7053a). Step 2 built the window's
parts in `window/src/ui/`, from the mock's direction A: Button (plain, primary, ghost, warn; two
sizes) and IconButton; Pill (states only in green, amber, red), Topic chip, Label (the one
uppercase), Kbd; Segmented; Switch; Field and Select; List, Row and Tile; the Card shell (a sunk
head naming the gate, "Waits for you"); the Side panel (320px, right); Section. Icons are
lucide-react 1.59. The label tracking became a token.

The screens use them: Settings (connections and folders as rows with state pills, forms on
fields), Kits and agents (a switch per agent), Home (the gate card on the shell, run lines with
Open and Pass, the work fold, the composer with its send button), Activity (one list, state
pills, 24-hour times), tables (Table · Board as a segmented control, a value's kind as a pill).
Layout is otherwise as it was: the shell, Home's anatomy, the source panel's place and Activity
by day are steps 3 to 6. A Parts page (`#/parts`, not in the rail) shows every part, and the
shots take it, so a part is seen in light and dark before a screen uses it.

## Step 3: the shell (uncommitted, for Kenil's review)

Step 2 committed and pushed (34948a7). The shell (`window/src/Shell.tsx`), as the mock's A:

- **The rail, 216px:** its top 48px left for the Mac's window buttons; the mark and "Kenil · on
  this Mac"; Home with a badge counting the cards waiting on the person; Activity with a spinner
  while an agent's run is going (the stream now says how many: `running`); Modules as a tree,
  each module folding, its tables with their row counts; Settings and "Alpha is running" (or
  "not answering") at the foot.
- **The bar, 48px, over every screen:** crumbs (Home; DealPilot › Deals) and Find.
- **Find, ⌘K:** every screen and table by name, those starting with the words first; Return
  opens one. Checked by hand: "dea" opens Deals.

Ask (⌘J) waits for step 8, where the module's Conversation panel it opens comes.

## Step 4: Home (uncommitted, for Kenil's review)

Step 3 committed and pushed (3b123b6). Home, as the mock's A:

- **Core:** every stream line carries its module (id and name); the stream lists the runs going
  now (`running`) and the connections waiting on a sign-in (`attention`); a card's closing line
  carries its answer.
- **Messages:** the person's words in a bubble on the right; Alpha's reply under a meta line
  (the mark, "Alpha", the module's topic chip, the time); an agent's report as a box of rows
  under its own meta line; day lines (Today, Yesterday, the date); notes centred and quiet.
- **The live message** says what Alpha is doing, with Stop (moved from the composer).
- **Cards:** the gate named in the head, "Not now" for a plain No, and "Change something",
  which starts the composer with the card's words. Answered, a card folds to one line where it
  was ("You said yes", "You chose Add", the card's words cut to fit). A card an agent's run
  opens outside a turn now shows as a card, not only as a note.
- **The Now strip** above the composer: what waits on the person first (a card: scrolls to it
  and flashes; a sign-in: Settings at that connection), then what is running (opens Activity);
  three at most.
- **Lenses:** a topic chip keeps Home to its module; the bar shows "Only DealPilot ×".

Tried in the test copy: a request that needed a new site put its card in the stream, "1" on
Home in the rail and a Now chip; Not now folded it to its line, and the live message showed
Stop while Alpha carried on.

## Step 5: tables and the source panel (uncommitted, for Kenil's review)

Step 4 committed and pushed (976a6b5).

- **Core:** a value's history (`records.history`, newest first, a value kept across versions
  shown once; `GET /api/tables/:id/rows/:row/history?field=`); the window may set any plain value
  as the person's word (text, number, money, date, choice, email, link, phone), never a
  relation, file or person. **A slip found and fixed:** the runner's "what the person said
  stands" check for `rows.compute` read provenance by field slug where it is kept by field id,
  so a script's figures could still write over a stated value; it now reads by id, with a test.
- **Tables:** the title with its row count; a toolbar with Find (filters the rows) and Table ·
  Board; the header and the name column sticky; amounts and numbers on the right in even
  figures, "None given" in grey when not known; choices as pills; estimated and assumed values
  italic with ≈ or ?; relations by name.
- **The source panel (320px, right):** opens on any value and stays open along the row; the
  value in serif and its row's name; the kind as a pill with when; why, in words; Open the page or
  the file (at its cell); Correct it, saved as the person's word; the value's history.

Tried in the test copy: Loan needed's history showed $1,080,000 then $960,000 after Kenil's 20%
down payment; correcting a deal's SDE to $300,000 showed "You said", and the figures followed it
within seconds (SDE after debt service −$23,844, Does not fit).

## Step 6: Activity (uncommitted, for Kenil's review)

Step 5 committed and pushed (4a62cec).

- **Core:** each connection's read is now a journal line (`connection_read`: how long it took,
  whether it brought anything, or why it failed), so Activity holds connections' reads beside
  agents' runs. Each run says how long it took, whether the model was used (agents' scripts run
  without it: "No model"), and whether it changed nothing (quiet).
- **Activity:** one list by day (Today, Yesterday, the date); a run's time in mono, its name and
  module tag, its state when it is not Done, one line of what happened, how long it took and
  "No model"; it opens to its steps with times; runs that changed nothing fold into one line per
  name and day ("Gmail read 9 times with nothing new"); All · Didn't finish.

**Restarts without asking** (Kenil, 10:34: "do not ask again for restarting alpha"): the prompts
were the Terminal panel's approval of each command typed into it. Restarts now go through
`.data/restart.sh mine|test` (not in git: it names this Mac's paths), which starts the core in
its own session, so it outlives Claude's.

## Step 7: Settings (uncommitted, for Kenil's review)

Step 6 committed and pushed (847ed02). Settings is one page with an index on the left:
Connections, Folders, Kits and agents (as before, on the parts), and three new sections:

- **What Alpha remembers:** the standing instructions the person gave (`remember`), for them or
  for everyone, each with Forget (journaled as `forgot`). The proposal's "Standing permissions"
  waits for Always, which v2 does not have yet.
- **Model:** the model Alpha runs on and its route, read from `core/config/models.yaml`; shown,
  not a setting.
- **Appearance:** Match Mac · Light · Dark, kept in this browser and put on `<html>` as
  `data-theme` (the Mac shell keeps it in week 6); a switch for connection tables in the sidebar
  (all of them at once; each connection's own link stays).
