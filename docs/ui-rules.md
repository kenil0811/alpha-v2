# The window's UI rules

Every rule the window keeps, one line each, as agreed with Kenil. Read this before any change to
`window/`. A rule lands here, with its date, once Kenil has said yes to it; where this list and
`docs/design.md` §14 disagree, the design wins and this list is corrected the same day. A rule
Vikas or anyone proposes waits under "Proposed" until then.

**Held by** names the test in `window/src/look.test.ts` that fails when the rule breaks: **test**
holds it today, **skip** is written and waits on its fix, **—** cannot be checked by code and is
held by review. Dates are 2026.

## Shell and rail

| # | Rule | Date | Held by |
|---|---|---|---|
| S1 | The rail is module names only: Home, Agents, Tasks (until pinned), then each module, with modules inside one folded under it; Alpha's own module is not there | 20 Oct, 26 Oct | — |
| S2 | Settings at the foot of the rail with a small brain icon for the Second Brain beside it; folded, the brain sits above Settings. Intelligence is not on the rail | 25 Oct, 28 Oct | — |
| S3 | The rail's head is the workspace: a menu of Settings, Second Brain and Appearance | 26 Oct | — |
| S4 | A module's menu (⋮ or right-click): Open, Move to, Hide, Hidden modules; modules drag into one another or out to the top | 26 Oct | — |
| S5 | How the person left the window (the rail's width, folds and hidden modules, the assistant, rows to a page) is kept per person by the core, never in the browser | 26 Oct | — |
| S6 | Both side panels drag by one edge and fold; the rail folds to a strip of icons (⌘\\) | 25 Oct | — |
| S7 | Menus sit against the window, never clipped by a scrolling box | 25 Oct | — |
| S8 | Heights use `dvh`, never `vh` (a phone's browser bars) | 2 Sep | skip |

## Header bar and tabs

| # | Rule | Date | Held by |
|---|---|---|---|
| H1 | One 48px bar across the rail's top, the page and the assistant: a way back on the left when inside something, the screen's name centred | 25 Oct | — |
| H2 | A screen with parts has one row of tabs under the bar, every label in full, scrolling sideways; never cut short or folded to icons | 26 Oct | — |
| H3 | No Find box in the bar; ⌘K finds anywhere | 26 Oct | test |

## Module page

| # | Rule | Date | Held by |
|---|---|---|---|
| M1 | A module's tabs: People and Organizations where its module.yaml says so, its pages, its main tables with their counts (a table part of a row, or setup, is not a tab), Conversation, Agents and notes | 26 Oct, 27 Oct | — |
| M2 | Nothing sits under a table or a page; agents, the module's other tables (setup, and parts with what they are part of), notes, recent activity and Governance are the Agents and notes tab | 26 Oct, 27 Oct | — |
| M3 | Governance shows only rules the core holds and enforces, Allowed and Denied, each saying where it came from; New or Add (the one list control, 30 Oct) starts the conversation; a rule of yours has Revoke behind ⋮, one Alpha noticed Approve and Dismiss | 26 Oct, 27 Oct | — |
| M4 | New module opens a page: a name, what it keeps track of, Build it asks Alpha | 26 Oct | — |

## Table and toolbar

| # | Rule | Date | Held by |
|---|---|---|---|
| T1 | One toolbar line: saved list, view, Search, Filter on the left; Columns and ⋮ on the right; Save and Cancel only while the list differs from its saved self | 26 Oct | — |
| T2 | No cards of counts above or below a table | 26 Oct | test |
| T3 | New sits in the page row under the table and works while the assistant is open | 26 Oct | — |
| T4 | A click on a row's name opens it in the side panel, with Open full to its own page (#/row/…), one view in both: fields, notes, its parts as small tables with New, Linked here, files, tasks; a double-click edits a value, in the grid and in an opened row | 26 Oct, 27 Oct | — |
| T5 | An empty table keeps its header, blank rows and footer, and says nothing | 26 Oct | — |
| T6 | Every menu works from the keyboard and opens on a right-click where it belongs; one list, never a second | 26 Oct | — |
| T7 | The overflow glyph is the vertical ⋮ | 25 Oct | test |
| T8 | Rows come 25, 50, 100 or 250 a page, with First and Last | 25 Oct | — |
| T9 | Ticked rows show "n selected"; Escape lets them go after any menu closes | 26 Oct | — |
| T10 | Every dropdown is one of ours: search past six, ★ to keep an option on top, Add new… at the foot where a choice can grow; a double-click on a choice opens it | 26 Oct, 29 Oct | — |
| T11 | No bare `<select>` where a person picks; only the cell editor keeps the native one | 25 Oct | test |
| T12 | Freezing and wrapping columns are kept with the saved list, like widths | 26 Oct | — |
| T13 | A cell's History (old → new, who, when) is on its right-click menu; ⇧↓ and ⌘D fill down, after a yes | 26 Oct | — |
| T14 | A summary shows as the kind it comes to and is never typed; what it is, in words, is on its column's tip and menu | 27 Oct | — |
| T15 | Tags show as chips and are picked from a tick list; filtered by has any of, all of, none of; never a board's columns or a group | 27 Oct | — |

## Pages, records and deleting

| # | Rule | Date | Held by |
|---|---|---|---|
| R1 | A section is its serif title and ⓘ over what it holds, never a card; nothing sits in a card inside a card | 26 Oct | — |
| R2 | One record layout: the way back in the bar, a centred column, a line naming the record, its serif title, its sections; a row's page too | 25 Oct, 27 Oct | — |
| R3 | Delete is never one click: behind ⋮, always confirmed in our own pop-up, saying what goes, the parts that go with it, and how long Bring back returns them, in the core's words | 26 Oct, 27 Oct | — |
| R4 | Never the browser's `confirm`, `alert` or `prompt` | 25 Oct | test |
| R5 | A refusal shows in a line beside the control that was pressed | 25 Oct | — |
| R6 | Revert, and Bring back on a removal, sit behind an Activity line's ⋮, said first in the one pop-up from the core's own preview of the same work | 26 Oct | — |

## Assistant and chat

| # | Rule | Date | Held by |
|---|---|---|---|
| A1 | The assistant's header: fold, face and name, the pencil, the bell; no Expand, no Open whole conversation | 26 Oct | test |
| A2 | The person's words in a light bubble on the right; Alpha's on the surface on the left, a grey line under each | 26 Oct | — |
| A3 | The composer's +: files, a folder, Model ›; @ names an agent | 26 Oct | — |
| A4 | Every icon button has a label, read aloud and shown on hover in our one tooltip, never the browser's title | 26 Oct | test |

## Intelligence and Settings

| # | Rule | Date | Held by |
|---|---|---|---|
| I1 | Second Brain: Graph (the default: Alpha, every module sized by its rows, its main tables and agents, the connections, the links between modules), Across modules, Connections, Agents. Settings holds Governance (How to work, Decisions, Noticed) and Connections too | 26 Oct, 28 Oct | — |
| I2 | Settings: Model, Modules, Permissions, Data, Appearance, Help, one at a time; Experimental only while something is tried | 26 Oct | — |
| I4 | Settings › Permissions lists every rule across Alpha, each opening its page (#/rule/<id>), in place of standing permissions | 27 Oct | — |
| I3 | Settings › Model: each way on its row with its state, its key and Use this | 26 Oct | — |

## Wording

| # | Rule | Date | Held by |
|---|---|---|---|
| W1 | Module, never kit or project | 23 Oct | test |
| W2 | Organization, never company; Second Brain, never remembered; Download, never export; Delete, never remove; Decline or Cancel, never "not now"; Decline, never Veto | 25 Oct | test |
| W3 | No line for what Alpha can't do yet; a line that can't act now stays greyed with its reason; never "Coming soon" | 26 Oct | test (words) |
| W4 | Sentence case for labels, buttons and placeholders | 25 Oct | test |
| W5 | Dates read "25 Oct" (the year only when it isn't this one), typed as words; never a dd/mm/yyyy picker | 26 Oct | — |
| W6 | Plain words: no tool names, no ids; the window never names the apps it learned from | 25 Oct | — |

## Look

| # | Rule | Date | Held by |
|---|---|---|---|
| L1 | Colours and sizes are the tokens in `app.css`, nothing written out | 20 Oct | test |
| L2 | Seven text sizes, a 14px body, 11px capital labels | 26 Oct | test (seven sizes) |
| L3 | Serif for page, record and section titles and big numbers only | 26 Oct | test |
| L4 | Scrollbars thin, a 4px thumb shown while the box is under the pointer; a row of tabs shows none | 26 Oct | — |
| L5 | One avatar for people and organizations | 25 Oct | — |

## Proposed, waiting on Kenil or the core

- S1 signal dots as the one state mark, a bullet before the words: pulsing needs you now, filled
  waits for your yes, hollow optional, green running; each says so on hover (Vikas, 27 Oct).
- S2 a chart's kinds in one dropdown on its card; every mark opens the rows it counts, filtered,
  with Show original list (Vikas, 27 Oct).
- A row's own page is the whole width, made for the row: the module's mark, its table, its title
  (a double-click renames it), its states (each toned choice) in a line under it; its properties
  a line each with an icon, the empty ones folded, and under them its document as open blocks
  ("/" for a kind, Markdown starts, to-dos, drag to move), kept as Markdown in its notes; beside
  them one column of what hangs off it: each part a short list, links, files, tasks (Vikas, 27 and
  28 Oct; replaces R2 for rows if agreed).
- A module opens on its Overview: the pulse strip, its own work left, the standard column right
  (Interview me, Files, Agents, Intelligence, What Alpha may do, Tables); a card's head is its name
  only; nothing on it twice (Vikas, 27 Oct; replaces M1 and M2 if agreed).
- The standard column is the default, not a suggestion: it opens on the right in every module, and
  blocks move within or across the two columns (Vikas, 30 Oct).
- Intelligence has Connections, Second Brain, Agents and Governance. Second Brain is the layer
  across modules. Governance is what Alpha keeps about itself: notes, rules and decisions
  (Vikas, 27 Oct).
- Settings › Usage shows what the model cost by day, model, module and agent, with the prices it
  counts at. An estimate is marked ≈ (Vikas, 27 Oct; replaces "What each run costs" below).
- The rail and the assistant fold and open the same way: one narrowest width, a fold mid-drag
  past it, a drag out from the folded strip, an Open button on each strip, and mirrored shortcuts
  (Vikas, 27 Oct). Folded, each is a strip of icons with their names under them (`stripItem` in
  `ui/edge.tsx`; Vikas, 28 Oct).
- Home: greeting and date in the bar, Find on top, one strip across every module (Needs you,
  Interview me with its top questions, Agents, Tasks, What changed), two columns, no box to ask
  Alpha (Vikas, 28 Oct).
- Interview me never sends a fixed prompt and never a fixed count: it opens the Interviewer's
  thread and asks the most useful question in today's ranked pool first, with its why, stopping
  when the next is worth too little or the person is done; on a hover it says what was prepared
  and the first question; while the questions are being prepared it says Preparing… with Stop
  (Vikas, 30 Oct; proposed).
- No Conversation tab in a module; Conversation is its own screen with the list view (Vikas, 26
  and 28 Oct).
- Toolbar: search first and wide, Filter right beside ⋮, Columns inside ⋮, nothing under it (the
  lists are in the lists dropdown, below), no row count under it; the count sits just above New (Vikas, 26 and 28 Oct; replaces T1 if agreed).
- People has Lists: Clients, Insurers, My team and the like from the tables whose rows are
  people, My contacts for the rest (Vikas, 28 Oct).
- A chart shows only when it says something (its bars differ, eight rows or more); a hover adds
  what the mark does not already show (Vikas, 28 Oct).
- A module's name says on hover what it is for (Vikas, 28 Oct).

### One library (Vikas, 28 Oct)

Use the control in `window/src/ui/` that does the job; make a new one only when none does, and
put it there and on the parts page (#/parts).

| Control | File | Where |
|---|---|---|
| Pill switch | `ui/pill-switch.tsx` | The bar of every screen whose pages each hold their own data: a module's tables and pages, Network, Second Brain. Nothing else; underlined tabs are gone |
| List view | `ui/side-list.tsx` | A list left, the chosen page right, as Settings: Settings, Conversation, Governance, a table's List view |
| Cut buttons | `ui/cut.tsx` | Cuts of one list (Today, This week, a saved list, 30 days), with counts, under the toolbar |
| Segmented | `ui/segmented.tsx` | Only picking a value in a form (Look, Text size, a task's state) |
| Drop zone | `ui/drop-zone.tsx` | Every place files are added, one kind (`accept`) or many |
| New, Save, Cancel | `TableView.tsx` | New under every view; Save and Cancel beside it |
| Square icon tile | `ui/icon-tile.tsx` | Places pinned atop the rail (Home, Conversation, Tasks, Network to start; up to 12) and a module's actions atop its Overview's standard column |
| Pager | `ui/pager.tsx` | Every way through pages: a table's pages and Needs you's Slides. ‹ and ›, each page's number while there are seven or fewer, else "3 of 12"; nothing for one page |
| Side panel | `ui/side-panel.tsx`, `Peek.tsx` | What a click opens first: an element (row, agent, run, rule, task, person) from anywhere, and from Home or inside the panel any screen too (a module, a table, a list, Activity, Intelligence); editable there, Back to the step before, a large Open page at its foot. The rail goes to the page |

- Nothing on screen twice, and no card, tile or bar that says nothing (a nought, a single-colour
  bar, an empty heading). An empty group is not shown; no "Nothing due" lines. Where an empty
  state has a next step, it is a button (Connect Contacts, Review listings) (Vikas, 28 Oct).
- Text comes in five sizes: 10, 14, 18 (body), 24 and 32; spacing grows with them, one step 5px.
  Nothing is in capitals (Vikas, 28 Oct; replaces the 12px floor).
- Everything that asks for action has a button saying the action: an open task says Start,
  Done or Review (Vikas, 28 Oct).
- One word for one thing, the words any business app uses, kept in `window/src/vocabulary.ts`
  and checked by `look.test.ts`: Needs approval, Possible duplicate, Not a duplicate, Failed,
  Clear filters, Restore, Related, active (Vikas, 28 Oct).

- Undo of one change from a cell's History (the core reverts a line since 26 Oct; the cell's menu waits).
- A module's files listed under it, renaming a module and choosing its icon (needs the core).
- What each run costs, shown under Settings › Model (needs the core).
- A choice column's default for everyone, and flagging a cell as wrong (needs the core).
- Fewer explanatory sentences on screens, redone on today's screens.
- On a phone, a bottom tab bar with modules and chat as drawers.
- Nothing is pinned atop the rail to start; past 12 modules Alpha asks once, as a task, which
  places to pin. Right-click a place or a module to pin it (Vikas, 28 Oct).
- Header and rail text one step up: rail items 18, the bar's crumb 18, a screen's title 32,
  section titles 32, the side panel's title 18 (Vikas, 28 Oct).
- A table whose rows report to its own rows ("Reports to") shows an organization chart first on its
  module's Overview; those who manage no one stand in a column under their manager (Vikas, 28 Oct).
- Every link opens: a link, email or phone value, a web address or email in words, a linked row's
  name and the Related list; places in Alpha open in the side panel (Vikas, 28 Oct).
- One Back (`ui/back.tsx`): an arrow and "Back" at the left of the header on every screen but
  Home, the same in the side panel (Vikas, 28 Oct).

### Everything actionable, Governance apart (Vikas, 29 Oct)

- Every chart stretches from its corner, is redrawn at its box's size, and scrolls both ways
  below its least size. What the pointer is on in a chart or graph is drawn last and outlined.
- Anything that floats is portalled to the window, or into the open dialog, on one scale
  (`--z-raised` 10 to `--z-tip` 60 in `app.css`); never a bare z number. A scrolling box with
  sticky parts is `isolate`.
- Over a link, the foot of the window says where it goes: the address with ↗ outside Alpha, the
  page's name inside.
- Governance is its own section, two columns, Can do and Cannot do, of enforced rules only:
  approved is solid, waiting is greyed on dots with Approve; agents' rules sit under the agent's
  name. A rule is added with the one list control (New, or Add at the column's head; below) or by
  asking Alpha. Figures and connection states are never rules.
- A module's page goes Agents, Governance, Tables, Second Brain. Alpha's own module is 1
  (Decisions 1.1, Noticed 1.2), the rail's modules follow in rail order from 2, and tables under
  them (2, 2.1, 2.1.1); every table counted is listed. Across modules, the Tables card is a line
  per module, closed at first, opened and closed by a click (Vikas, 30 Oct).
- One level, one font: what stands at the same level (a card's title; a group's head inside a
  card, as Agents' "Sourcing" and Governance's "Can do") reads the same size and weight wherever it
  is (Vikas, 30 Oct).
- A page that only analyses a module's tables is charts on its Overview, not a page.
- Every block on Home and an Overview has a handle on hover: drop it beside, above or below
  another; the arrangement is kept per person by the core.
- Every figure has a button saying what to do about it, going to the exact rows. Up to six goals
  show one each; a goal that is behind has one task, kept to its numbers, closed when met.
- A figure's hover splits it along the field that best explains it, never its own stage.
- One card, one row: Needs you lists each waiting card as its own row with its own buttons,
  under a heading per agent ("Morning 4") that carries Approve all where its cards share options;
  a proposal's tasks are a row each, with Add and Decline; drafts are never sent in bulk. An agent
  past its limit of waiting cards (`core/config/limits.yaml`) waits and says so, and like rows
  join the card already waiting (Vikas, 30 Oct; for Kenil's review; replaces "Cards of one kind
  in one module are one card, 1 of N", 29 Oct).
- An Overview, a list or a screen is never blank: Loading…, a line saying what will show and how,
  or the refusal. No row of icon tiles at the top; a lone action is a button with its words.
- Agents are grouped by what they do; the module is a column and a filter. Their list says how
  often each runs (a dropdown, written into its file), when it last ran ("12 min ago", the time on
  hover), and Running or Paused beside the switch. New agent is the first control.
- A blocked agent is red: a red dot, the reason in words, the one button that unblocks it.
- Turning an agent on runs it now; "Running now…" until it ends. Update now (below) re-runs it.
- The rail's head is the workspace: picture and name, each changed by a double-click. Its menu
  holds who is signed in, Appearance on one line, Switch account and Log out; never a place the
  rail already has. Every count on the rail says on hover what it is made of.
- Marking dims the window and lights what is under the pointer; its banner wears the accent ring.
- Network's switch is Overview, People, Organizations and Map (Organizations back on 3 Nov). A table that names people by
  a role's address ("Broker email") puts them in that role's list (Brokers).

### Agents as threads, Tasks never empty (Vikas, 30 Oct)

- Agents is a list of whom to talk to: Alpha first, then each agent grouped by what it does, each
  with its last line and what waits on you; each opens its own thread. A module is never a thread.
- A message's author is who said it, Alpha or the agent by name; the module is a small chip.
- Every card and agent's post opens whole in the side panel (`#/card/<id>` or its run): the card
  with its actions, the runs it rests on, its history.
- A card's source line ("Rests on…", "<agent>'s email", a row's name) links to what it names;
  plain only when nothing in Alpha holds it.
- Agents of one module that did not finish are one card: each with its reason in words and its
  own Try again and Leave it, plus Try again all and Leave all; a new failure joins it.
- An agent's post repeated unchanged shows once, at the time it was last said. A newer proposal
  from an agent stands for its earlier ones still waiting.
- The Interviewer is listed under Agents after Alpha, as an agent (it is a skill of Alpha's
  underneath). Interview me, on Home and on every Overview, opens its thread (scoped to the
  module it was pressed in); its lines are labelled Interviewer.
- Anything that loads past a moment says what it is doing ("Preparing…") with Stop beside it;
  Stop ends the wait and the thread says "Stopped." An Alpha turn has Stop while it works.
- New agent is the first control wherever agents are listed: atop the Agents list, atop the
  agents table, and a "New agent" line at the foot of a module's Agents card (that module
  chosen). The word a person sees is "agent", never "automation".
- On a module's Overview, Interview me is a square, smaller than the strip's tiles, first in the
  standard column above Agents; nothing sits beside the strip.
- Home has an Overview's two columns: its work left (Needs you, Today and overdue, What changed)
  and the standard column right across every module (Agents grouped by what they do with New
  agent, Governance, Tables, Second Brain, Files). At its head, above Agents, two rectangular
  buttons of one size: Interview me, and Getting this Mac ready with its count while setup is
  unfinished, its steps opening under them; neither is a tile in the strip (Vikas, 30 Oct; for
  Kenil's review).
- Tasks opens on the first list that holds something. Needs you holds every card waiting
  on the person, then the tasks waiting on them, each with its button.
- Needs you switches List, Card and Slides with the tables' view dropdown; Card is a
  grid of tiles: what it is, its state, its module, its title, what it's about, its buttons. Every
  card's first button is the one thing to do; a click elsewhere opens it whole.

### Needs you, one list (Vikas, 30 Oct; for Kenil's review)

- Needs you is one list, drawn by one component on Home and in Tasks: sign-ins, every card under
  who it is from, then the tasks waiting on the person that no card there stands for. A task
  waiting on cards is not a second row: each card says "For <task>", the task's state reads
  Needs your input, and its Review opens its first card.
- Task and card rows share one fixed grid with a header: state, title (what it's about under it),
  state in words, module, owner, date, buttons. The date is right-aligned at the same place on
  every row; narrow, module, owner and state words fold. The one thing to do is the rightmost
  button.
- An agent's state is the task's state: Needs your input, "<agent> working"; no extra pills.
- Every task and card opens in the side panel; its page is Open page at the panel's foot.

### Stretch, layers, buttons, Home and blocks (Vikas, 30 Oct)

- Resizing adds no chrome (Vikas, 30 Oct: "minimalistic UI rather than so many new elements"):
  no handles, bars or borders, only the cursor. A chart's x-axis (the strip it and its labels are
  drawn in) shows ↔ and a drag stretches the drawing wider or compresses it; its y-axis shows ↕
  and a drag up heightens the drawing (down shortens it) while its box keeps its height, the
  origin the anchor: the foot stays where it was and the top is what scrolls away, the drawing
  scrolling up and down inside the box as a wider one scrolls sideways; the box's bottom-right
  corner shows ↘↖ and is the one way to change the box, the drawing with it
  (`Stretch` in `ui/chart.tsx`). Bars and heat take their label strips as axes; donut and rings
  have the corner alone. A click on an axis strip is the strip's, so a double-click fits it back
  and never opens what is beneath; a focused axis takes the arrows. A drawing wider or taller
  than its box scrolls inside the box, never the page; a double-click on the y-axis fits the
  drawing back to the box. Replaces the edge handles of the same
  day and "stretches from its corner".
- What opens on a hover is the top layer: a box that lets a tile or a list spill over what follows
  is raised as a whole (`relative z-(--z-raised)`), never `isolate` alone, since a positioned dot
  after it paints over it. Anything clipped is portalled (`floatRoot`).
- The same line said again in one list is said once with ×N.
- Every button changes colour under the pointer: the plain one and the ghost turn to the accent's
  soft tint, the primary darkens; the focus ring is `app.css`'s, for every kind. A raw `<button>`
  that looks like a button does the same.
- A row of buttons (a card's actions, a dialog's foot, a task's button) sits at the right, the one
  thing to do first: `Actions` in `ui/card.tsx`, the Dialog's `actions`. A switch in the same row
  is last, right of every button and link (Vikas, 2 Nov); beside one, Update now keeps its time on
  its hover.
- Home says each thing once: the Needs you tile counts all that waits, questions with it, and goes
  to Needs you without listing it; Interview me is a tile only while no question waits.
- A task row is one grid: state, title and where, the date (a fixed column, at the right), the
  state pill (a fixed column), the button; the same place on every row.
- A strip of tiles is one row of square tiles (`Strip` in `Overview.tsx`, Home's too) that scrolls
  sideways inside itself, snapping to a tile, its scrollbar shown only under the pointer; a hover or
  a click opens the whole name and what it counts in a popover over the page, never clipped by the
  row. Replaces "evened over the rows" of the same day. Every tile is one size whatever the room,
  as tall as what it holds, no room left empty, its words 18 (Vikas, 2 Nov; replaces square, 30
  Oct), and one layout, three lines in
  all with its button: the number big and left, two lines tall, its words beside it on both lines
  ("0 listings reviewed · of 13 this week"), whatever the number's length (Vikas, 2 Nov; replaces
  a long number on its own line); then one row, the spark at the left and the one button at
  the right, its words on one line (all of them on hover). The signal is a small dot on the
  button, before its words, and nowhere else on the tile. With nothing to do the button stays,
  greyed, saying it is done ("All engaged"), its hover saying why (Vikas, 30 Oct; for Kenil's
  review).
- Wherever something can run again now (an agent's line, Insights, a table's readers, an agent's
  page) it is one button, Update now, with when it last updated just before it ("Updated 12 min
  ago", "Updated 12:42", "Updated 29 Oct, 13:34"; the full time on hover) and Updating… with the
  icon turning while it runs (`ui/update-now.tsx`). Replaces Sync now, Look again and Run now
  (Vikas, 30 Oct; for Kenil's review). It stays at the right of a card's head however narrow
  the card: under 22rem the "Updated" words go and their time moves to the button's hover.
- Every card is a block the person moves (its handle on hover) and resizes from its bottom-right
  corner alone, the ↘↖ cursor its only mark (width a share of its row, height in pixels, kept as
  "key@40x320"; double-click gives it back); sized smaller than it is, its body scrolls under its
  header, which stays in sight (`data-head`), kept per person by the core: Home, an
  Overview, a module's Agents and notes, an agent's page, Second Brain, Usage, Connections.
  A table's own views are not blocks. Sized, only its last part scrolls (a framed list,
  `data-frame`, where it has one), so its frame and bottom border stay whole; blocks stand 40px
  apart, in a column and between columns, so each card reads as its own (Vikas, 2 Nov).

### Needs you as tasks, Slides, one pager (Vikas, 30 Oct; for Kenil's review)

- Everything that needs the person is a task: each waiting card is a row of Tasks › Today, This
  week and All open, state Needs your input, owner You, From the agent that raised it (or Alpha),
  read from the cards and gone once answered; a click opens the card. A card serving a task in
  the list is that task's state, not a second row.
- One count for what waits: a row per sign-in, per card, per proposed task still wanting a word
  (`needsCount` in `Waiting.tsx`); Home's tile and block, the rail's badge and Tasks' cut agree.
  Tasks' Needs you holds only what waits on the person; a task waiting on someone else is not there.
- A card shown as a card says what it asks, written out: the agents that did not finish by their
  reasons ("It ran past its 15 minutes for 10 of them; the Mac was offline for 5"), a proposal's
  tasks, a review's rows, a draft's message. Its buttons sit at the bottom right.
- Needs you's view switch is List, Card and Slides. Slides is one card large, the pager beside
  its buttons, ← and →; an answered card gives its place to the next. A heading's name in the
  list narrows every view to that agent, with Clear filters.
- Every table and slideshow pages with the one Pager (`ui/pager.tsx`): ‹ and ›, each page's number
  while there are seven or fewer, else "3 of 12"; replaces T8's First and Last.
- A goal's tile says what it counts ("0 listings reviewed · of 13 this week") and its button's
  hover what it opens, as the view shows it ("1,015 listings to review"). A weekly goal counts the
  rows whose stage was set this week, and never a row that left (Passed, Lost); its links open in the side panel, filtered; a link to no
  rows is not offered. A table opened in the panel shows just the rows a figure counted. Any link
  to the rows a figure counted (a tile's button, a chart's mark, a goal's line) opens in the side
  panel wherever it is (`COUNTED` in `Peek.tsx`); ⌘-click or Open page goes to the page.
- Back returns to where the person was, wherever that was; only a screen opened first (a link
  from outside, a reload) goes to the place above it (Vikas, 30 Oct).
- Under 64rem, task and card rows fold state, module and owner, so the title keeps its room.

### Lists dropdown and choice colours (Vikas, 30 Oct)

- The lists dropdown, named for the list on screen, holds the lists to choose: All and the saved
  lists (★ on hover for the one the table opens on), then the values of the table's list choice
  (Clients, Insurers, Leads, My team; else the board's choice), each with its count; search past
  six, Add new… at its foot. Nothing repeats the lists under the toolbar (`ViewTabs`).
- A list's actions (Rename, Duplicate, Open the table on this list, Delete; a value's Keep as a
  saved list) are on a right-click of the dropdown or of the list's line in it, never in the
  dropdown itself.
- Every single and multi-select choice wears its own colour, the same in cells, chips, dropdown
  lines, filters and the lists dropdown: the tone the field gives it, else `--opt-1…8` in
  `app.css` by its place among the field's choices (words that are no choice, by their letters);
  never random. Each pair passes 4.5:1 in light and dark. One helper: `optionClass` and `Choice`
  in `ui/pill.tsx`.

### Lists, double-click, editable by design, the panel's edge (Vikas, 30 Oct; for Kenil's review)

- Every list a person keeps (Governance's Can do and Cannot do, How to work) is one control,
  `EntryList` in `ui/entry-list.tsx`: empty, its only line is New, which opens a box; with entries,
  a small Add at the right of its heading. A hover shows ✕ at an entry's right: undone as a removed
  row is, or asked first where nothing undoes it (Revoke, Decline, Forget). A double-click edits an
  entry, Enter saves, Escape lets it be. Replaces "a rule is added by typing at the foot of a
  column; never an Add a rule button" (29 Oct) and M3's "+ Add".
- A double-click edits, everywhere: a cell, a property, a state under a row's title, a title, a
  name, notes. A single click selects or opens and never edits.
- Editable by design: anything a card, an agent's line or a goal asks the person to fill, they can
  change where they see it. A choice is the one dropdown; a relation picks from its table's rows;
  a person field picks from the people; a date takes a date. Only what is worked out (a summary),
  a file and a list of rows stay fixed, and a double-click on one says why in the tip.
- The side panel stands apart from the page it opened over: a firmer left edge (`--edge`) and a
  soft shadow cast on the page (`--shadow-side`), in both themes; nothing more.

### Path, tabs row, Find on every Overview, two modules of Alpha's own (Vikas, 2 Nov; for Kenil's review)

- The bar's centre is the path to the screen: each step before the last small, grey and opening its
  place, then a ›; where it ends larger, in serif. Inside a module it ends at the module. A record's
  page drops its own "Module · Table" line (kept in the side panel, which has no bar). Replaces H1's
  "the screen's name centred" and the record page's blank bar.
- Every Overview opens on Find, the same wide box as Home's (`ui/find-bar.tsx`).
- Calendar and Knowledge Base are Alpha's own modules, installed at start like Network. Calendar's
  Events open on a calendar by start; the Mac's Calendar lands its events there once connected.
  Knowledge Base is one list of Documents, reports among them, newest first (3 Nov: named
  Documents).

- A place pinned atop the rail shows its name under its icon, three to a row (`named` on
  `IconTile`). A module dragged onto the middle of another goes inside it; onto the top or bottom of
  one, between them (a line shows where), the order kept per person by the core (`order` in the
  layout). Replaces S4's "drag into one another" alone (Vikas, 2 Nov; for Kenil's review).

- A screen's tabs sit in the bar, in its middle, on every module page and every screen of its
  own (Settings, Second Brain, Network). Only a record's page differs: the bar holds the path to
  the record, and its module's tabs (Overview and its main tables, the record's own chosen) sit in
  the row under the bar, so the person knows they are on a record, not a module's page (Vikas,
  2 Nov; the row stays fixed, never scrolling).
- Alpha is the agent, not a module: Home's Tables card and the numbering leave Alpha's own module
  out (modules number from 1, in the rail's order); its Decisions and Noticed stay in Settings ›
  Governance (Vikas, 2 Nov; replaces 30 Oct's "Alpha numbered 1").
- Network's tabs are Overview, People, Organizations and Map. Map shows every row that says where
  it is (a column named Location, City or Address) on an OpenStreetMap map, a pin per place, larger
  for more; a pin picked lists its rows (Vikas, 3 Nov; replaces 2 Nov's People alone).
- The rail is one line: Home, Agents, Tasks and the modules in one order, a module dropped above
  or below any of them, never into Home, Agents or Tasks (`railLine` in `Shell.tsx`; `order` keeps
  module ids and the fixed places' links). Replaces modules always below Tasks (Vikas, 2 Nov).
- A table's lists are a row of their own above search and filter: every list a pill, left-aligned,
  wrapping, the one on screen lit, its count beside it; + adds one; right-click renames,
  duplicates or deletes. The table's actions (New, Sync now, Save) sit at that row's right.
  Replaces the lists drop-down (Vikas, 2 Nov).
- The standard column, on Home and every Overview: its buttons on top (Interview me, Mac setup),
  each with its name under or beside its icon; then Files, as an explorer (a folder per table and
  kind of document, a path back up, the newest first, any file dropped on it added); then Agents, Governance and Tables as one card, a switch in its head (Agents left,
  Governance in the middle, Tables right). Agents shows New agent where there is none. No Second
  Brain card. Replaces the column's 27 and 29 Oct order (Vikas, 3 Nov).
- A tile's button is one standard word: Review, Answer, Start, Fix, Open, Explore or Done; what it opens is
  on its hover ("Review the 3 new"). Its spark keeps to its own room left of the button, never
  under it (Vikas, 3 Nov).
- An Overview's Find keeps to the module: "Find in DealPilot: sources and deals", its
  tables and its rows only. Home's finds everything (Vikas, 3 Nov).
- No chart of rows per week split by kind on an Overview (Vikas, 3 Nov: confusing).
- A click anywhere on a table's row opens its record, in the side panel; a double-click changes the
  cell. A link in a table is plain text, followed on the record (Vikas, 3 Nov; replaces T4's name).
- A module with one table and nothing else (Calendar, Documents) has no Overview: it opens on
  that table, its name alone in the bar (Vikas, 3 Nov).
- An Overview card has no Show more: it holds everything, scrolling past its height, and dragging
  its corner gives it more. No Insights card: the strip on top is the insights (Vikas, 3 Nov).
- One card per question of the rows, never two cards of the same numbers: a stage is one card,
  "now at each stage" or "reached each stage" (now there or past it) on its switch, what it counts
  under its name. No chart by when a row was first seen, no bubbles, no one goal's weeks beside
  Goals by week. A heat map only when two things vary apart (two thirds of its squares filled)
  (Vikas, 3 Nov).
- Goals open in the side panel, with Edit, where their rows change. Goals, What rules rows out and
  Where rows come from start in the right column, under the standard cards (Vikas, 3 Nov).

### Onboarding from the footprint (Vikas, 30 Oct; for Kenil's review)

- The Interviewer's thread opens on one card, "Before the questions", until the owner goes on:
  what Alpha could read, a row a source with its switch, what it does and its count (or Connect
  <service> while it is not connected), Update now for the counts. Nothing is read before its
  switch is on; Read what I ticked reads, and each row then says what it read and what it skipped.
- The default deny list shows on that card in one line, linking to Governance, where its rules
  are revoked as any other.
- The same card holds the AI-memory paste-back (the prompt with Copy, a box, Add these), Draft my
  business, and Ask me the rest, which ends the card and starts the questions. While the card
  stands, Interview me opens on it and asks nothing.
- The draft is the one review card under it (never inside it): a topic a row, the fact under it,
  where it came from under that; Confirmed or Dropped each; a double-click on the row fixes it.
- Settings › Governance › What Alpha read is the ledger: a source a row, what was read and when,
  what was skipped and why, a few of the items, Forget this source asked first in the one pop-up.
- Home's Welcome has "Let Alpha learn your business" first, done once the owner went on.

### Calendar gathers, Documents, the thesis fit, files as icons (Vikas, 3 Nov)

- Calendar is every date in one place: its own events, open tasks with a due date, and every
  row's dates (starts, due, expires, deadline, next step, closing) from every module, the
  gathered ones outlined and opening their record.
- Alpha's own modules sit atop the rail in this order: Calendar, Network, Documents; a client's
  modules after them. Knowledge Base is named Documents: guides, templates and reports.
- A page that is about one row (a client's report) is not a tab: it opens from that row's record,
  a button under its states, on that row.
- A module's tabs are its Overview and its main tables, each opening on the table view; a chart
  such as a funnel belongs on the Overview, never a tab of its own.
- Where a table has a fit choice (Thesis fit), the strip's first tile is "N deals fit your thesis",
  Explore; the scatter draws a dashed box around the rows that fit, its hover and the line under
  the chart saying so and opening those rows.
- A small table (2 to 7 rows) gets a card per figure it holds, a bar per row, so a module like
  Accounting shows its numbers, never No data yet.
- Files on an Overview show as icons, a folder or a file each, never a list.
- The switch in the Agents, Governance and Tables card sits in the card's centre.
- New module is the prompt alone, no empty table; under it, Or upload a module, a drop zone for a
  .alphakit file, the module opening once it is in.
- Every agent has a gear at its top right (its conversation on Agents, its page, its row on the
  Agents list), opening its settings in the side panel: Skills, Data and documents, Permissions,
  Connections, Schedule. Each gated call is a switch; off is a deny rule in Governance, on revokes
  it; nothing is kept outside Governance.
