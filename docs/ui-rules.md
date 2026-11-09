# The window's UI rules

Every rule the window keeps, one line each. Read this before any change to `window/`. A rule
lands here, with its date, in the same change that brings it in, whether Kenil's or a UI
contribution's (`docs/ui-contributions.md`). Where this list and `docs/design.md` §14 disagree,
the newer rule holds and Kenil brings the design up to date.

**Held by** names the test in `window/src/look.test.ts` that fails when the rule breaks: **test**
holds it today, **skip** is written and waits on its fix, **—** cannot be checked by code and is
held by review. Dates are 2026.

## Shell and rail

| # | Rule | Date | Held by |
|---|---|---|---|
| S1 | The rail is module names only: Home, Conversation, Tasks, then each module, with modules inside one folded under it | 20 Oct, 26 Oct, 7 Nov | — |
| S2 | Intelligence and Settings sit at the rail's foot, each its own row | 25 Oct, 7 Nov | — |
| S3 | The rail's head is the person's initial and name, no menu; how Alpha looks is in Settings › Appearance | 26 Oct, 7 Nov | — |
| S4 | A module's menu (⋮ or right-click): Open, Rename, Move to, Hide, Hidden modules. Rename edits the name in the rail (Enter keeps, Escape puts it back, a refusal under the box). Moving is on the menu: no drag, and no double-click on a module's name | 26 Oct, 1 Nov, 7 Nov | — |
| S5 | How the person left the window (the rail's width, folds and hidden modules, the assistant, rows to a page) is kept per person by the core, never in the browser | 26 Oct | — |
| S6 | Both side panels drag by one edge and fold; the rail folds to an 80px strip, each icon with its name under it (⌘\\); every panel narrows to 200px, folds then and there when dragged 48px past it, and a folded strip drags back open, a shadow showing the width it will open to; the edge's tip says what a drag does | 25 Oct, 2 Nov | — |
| S7 | Menus sit against the window, never clipped by a scrolling box; what floats over the page takes a name on one layering scale (raised, panel, overlay, pop, tip), a box keeps its own order with z-0 to z-3 | 25 Oct, 1 Nov | test (layers) |
| S8 | Heights use `dvh`, never `vh` (a phone's browser bars) | 2 Sep | skip |
| S9 | Beside each module in the rail, one signal dot for what it holds, the strongest of: needs you now (pulsing), waits for your yes (filled), something to read (hollow), running (green); a folded module shows the strongest of the modules inside it too; its words on hover | 2 Nov | test (signals) |
| S10 | The rail's rows are evenly spaced at 30px, the modules straight after Home, Conversation and Tasks with no gap above them | 2 Nov | — |

## Header bar and tabs

| # | Rule | Date | Held by |
|---|---|---|---|
| H1 | One 48px bar across the rail's top, the page and the assistant: the screen's name centred; no way back in the bar, and the name is not edited there | 25 Oct, 1 Nov, 7 Nov | test |
| H2 | A screen with parts switches them with one pill switch in the bar, every label in full, scrolling sideways; never cut short or folded to icons; a page opened beside keeps a row of tabs under its head | 26 Oct, 2 Nov | — |
| H3 | No Find box in the bar; ⌘K finds anywhere | 26 Oct | test |

## Home

| # | Rule | Date | Held by |
|---|---|---|---|
| O1 | Home is the date, the greeting, one line to ask Alpha, what needs the person only while something waits (each card answered there, and a sign-in), today's tasks, and Getting Alpha ready until it is done. Nothing else | 20 Oct, 26 Oct, 9 Nov | — |
| O2 | No modules on Home (they are in the rail); the conversation is the assistant beside it, never in Home's own space | 26 Oct | — |

## Module page

| # | Rule | Date | Held by |
|---|---|---|---|
| M1 | A module's tabs: People and Organizations where its module.yaml says so, an Overview when modules sit inside it, its pages with the front one first, its main tables with their counts (a table part of a row, setup, or one row per person in People's module is not a tab), then the parts and setup tables kept as tabs, and Setup, always last. A module opens on its Overview, else its front page, else its first table, else Setup | 26 Oct, 27 Oct, 28 Oct, 9 Nov | — |
| M2 | Nothing sits under a table or a page; where the module comes from, what it is for (its business case, Edit beside it, assumed while Alpha's), its schedules with Run now and on or paused, the module's other tables (setup, and parts with what they are part of, each with Keep as a tab, reading A tab while it is one; the same in the table's ⋯ menu), notes, what is the person's against the module's own, and Pack it are the Setup tab | 26 Oct, 27 Oct, 28 Oct, 9 Nov | — |
| M4 | New module opens a page: a name, what it keeps track of, Build it asks Alpha | 26 Oct | — |

## Table and toolbar

| # | Rule | Date | Held by |
|---|---|---|---|
| T1 | One toolbar line: saved list, view, Search, Filter on the left; Columns and ⋮ on the right; Save and Cancel only while the list differs from its saved self. Whenever rows are hidden, a line under the tabs says how many show and what hides them ("Showing 12 of 140 rows, filtered by Stage and a search"), with Clear filters; Cancel brings the saved list back. On a table a connection fills, ⋮ has Read now, reading every connection that fills it in one press (one waiting on a sign-in or the customer greyed with its reason, W3), and the line under the table says what reads into it and when ("Read by Gmail and Outlook, 10:42") | 26 Oct, 1 Nov | test (the line, read by) |
| T2 | No cards of counts above or below a table | 26 Oct | test |
| T3 | New sits in the page row under the table and works while the assistant is open | 26 Oct | — |
| T4 | A click anywhere on a row opens it in the side panel (a quarter of a second later when none is open, so a double-click can edit; at once when one is), with Open page to its own page (#/row/…), beside the assistant too when the window holds the rail, the page's 600px, the panel's 320px and the assistant (else the panel gives way and the assistant stays); a link to a task, a run, a person or a row opens it beside the page the same way, kept in the address so a reload keeps it, the panel holding every field, notes, its parts as small tables with New, its tasks with Add a task, and files, and its own page those with Linked here and Read from; a double-click edits a value, in the grid and in an opened row. A part's small table: its first three fields, one line a row, names never ids, long words cut with the whole on the tip; its twelve changed most lately with how many in all, and Open as a table for the rest | 26 Oct, 27 Oct, 28 Oct, 1 Nov, 9 Nov | test (room, beside) |
| T5 | An empty table keeps its header, blank rows and footer, and says nothing | 26 Oct | — |
| T6 | Every menu works from the keyboard and opens on a right-click where it belongs; one list, never a second | 26 Oct | — |
| T7 | The overflow glyph is the vertical ⋮ | 25 Oct | test |
| T8 | Rows come 25, 50, 100 or 250 a page, with First and Last | 25 Oct | — |
| T9 | Ticked rows show "n selected"; Escape lets them go after any menu closes | 26 Oct | — |
| T10 | Every dropdown is one of ours: search past six, Add new… at the foot where a choice can grow (one shared part, the tags picker too, with its search); a related row or a person is picked from one on a double-click, in the grid and an opened row (a relation holding several ticks rows, as tags do, T15), never with Add new… (a new related row is made on its own table); pasting, filling down and many rows at once leave them to Alpha | 26 Oct, 1 Nov, 2 Nov | test (picks) |
| T11 | No bare `<select>` where a person picks, the cell editor included: a choice cell opens our dropdown at once, saved on a pick, Escape leaves it | 25 Oct, 2 Nov | test |
| T12 | Freezing and wrapping columns are kept with the saved list, like widths | 26 Oct | — |
| T13 | A cell's History (old → new, who, when) is on its right-click menu; ⇧↓ and ⌘D fill down, after a yes | 26 Oct | — |
| T14 | A summary shows as the kind it comes to and is never typed; what it is, in words, is on its column's tip and menu | 27 Oct | — |
| T15 | Tags show as chips and are picked from a tick list; filtered by has any of, all of, none of; never a board's columns or a group | 27 Oct | — |
| T16 | People shows, after its own columns, the fields of its module's one-row-per-person tables, each named by its field (its table's name in front only on a clash); a person's page has a section for each; typing there writes that person's row, made if need be | 27 Oct | test |
| T17 | Every choice wears one colour by its place in its field's list (eight, round again), in cells, board cards, chips, dropdowns and filters; a choice that is a state keeps its tone's dot | 2 Nov | — |
| T18 | A cell whose value has another beside it (a page's or a connection's newer read, a script's figure) shows a hollow dot at its top right, its words on hover; its source panel says whose and when, and Reset says what it goes back to. The source panel opens from the right-click menu (a cell's in the table, a value's in the panel) or a link that names the value, never from a click on a row | 5 Nov, 9 Nov | — |
| T19 | A table's name changes from its ⋮ menu (Rename), greyed with its reason on a managed module; never by a double-click | 7 Nov | — |

## Pages, records and deleting

| # | Rule | Date | Held by |
|---|---|---|---|
| R1 | A section is its serif title and ⓘ over what it holds, never a card; nothing sits in a card inside a card | 26 Oct | — |
| R2 | One record layout: a centred column, a line naming the record, its serif title, its sections; a row's page too | 25 Oct, 27 Oct | — |
| R3 | Delete is never one click: behind ⋮, or a short list's ✕ (R8), always confirmed in our own pop-up, saying what goes, the parts that go with it, and how long Bring back returns them, in the core's words | 26 Oct, 27 Oct, 1 Nov | — |
| R4 | Never the browser's `confirm`, `alert` or `prompt` | 25 Oct | test |
| R5 | A refusal shows in a line beside the control that was pressed | 25 Oct | — |
| R6 | Revert, and Bring back on a removal, sit behind an Activity line's ⋮, said first in the one pop-up from the core's own preview of the same work | 26 Oct | — |
| R7 | A value Alpha is not sure of has a small grey mark (≈ estimated, ? assumed), never amber: its word on hover in a table, written out in a panel; an empty value is a grey dash in a table and "Unknown" in a panel | 25 Oct | — |
| R8 | A short list (How to work first, the others as they are touched): Add on its heading, ✕ on an entry when hovered, a double-click edits the entry in place (Enter keeps, Escape puts it back); where Alpha must understand an entry, Add starts the conversation | 1 Nov | test |
| R9 | A card has its own page (#/card/<id>), opened from ↗ on its head wherever it shows (the stream, Home): the same card across the page, a long letter whole, answered there as on the card; once answered the page says with what | 1 Nov | test (route), journey |

## Assistant and chat

| # | Rule | Date | Held by |
|---|---|---|---|
| A1 | The assistant's header: fold, face and name; no Expand, no Open whole conversation, no bell | 26 Oct, 9 Nov | test |
| A2 | The person's words in a light bubble on the right; Alpha's on the surface on the left, a grey line under each | 26 Oct | — |
| A3 | The composer's +: files, a folder; @ picks teammates, and the picks travel with the message. The way to Claude is Settings' business | 26 Oct, 7 Nov, 9 Nov | — |
| A4 | Every icon button has a label, read aloud and shown on hover in our one tooltip, never the browser's title | 26 Oct | test |
| A5 | The assistant is the conversation on the right of every screen but the conversation's own, Home included; open unless the person folds it (⌘J, ⌘⇧\\ or its fold) to an 80px strip with the face, then Open, named under its icon; it always leaves the rail and at least 600px of screen | 26 Oct, 2 Nov | — |
| A6 | A finished reply longer than four lines (`reply_fold_lines`) folds with More, above its first table when that comes sooner; one that opens with a table shows whole | 25 Oct | — |
| A7 | The chat holds the conversation: the person's words, Alpha's message for each turn, the cards still waiting, a question's answer as one line, and failures in the warning colour. A yes or a no, rows changed, a file filed, a rule saved and a run's report are on Activity. Nothing runs beside it | 7 Nov | test (stream) |

## Intelligence and Settings

| # | Rule | Date | Held by |
|---|---|---|---|
| I1 | Intelligence: Agents, Modules, Schedules, Connections, How to work. Agents lists each agent with the Chief of staff first, a row opening its page: what it is for, its instructions, what it remembers (edited in place), its skills, Open conversation and Delete. Modules lists every module and opens its Setup; installing one is below the list, the owner's alone. Schedules is one table, a row opening its page | 26 Oct, 7 Nov, 9 Nov | — |
| I2 | Settings: Model, Usage, Data, Appearance, Permissions, Activity, People where people sign in, one at a time, the version at the foot | 26 Oct, 7 Nov, 9 Nov | — |
| I3 | Settings › Model: each way on its row with its state, its key and Use this. Settings › Usage, a month at a time (months as a segmented control), its total "at API prices" on the subscription, then by module, by schedule and by model (models by name), largest first; a run's or a turn's cost on its Activity line | 26 Oct, 28 Oct | — |
| I4 | Settings › Permissions lists every rule across Alpha, each opening its page (#/rule/<id>), in place of standing permissions; every rule waiting on its Save card shows above them under Waiting for you, Approve and Decline answering the card itself | 27 Oct, 1 Nov | test |
| I5 | Settings › Activity lists what waits for the person above every run, and is the only place a run's report is read | 9 Nov | — |
| I6 | Settings › Data: the last ten backups, Go back on any, Back up now; taking data out, bringing it in and deleting it are the `alpha` command's | 9 Nov | — |
| I7 | Where Alpha asks people to sign in, Settings has People for the owner (who may sign in, a one-time link to pass on, Delete) and the foot says who is signed in with Sign out; a member sees no Model, Data or People, and no setup on Home | 9 Nov | — |

## Wording

| # | Rule | Date | Held by |
|---|---|---|---|
| W1 | Module, never kit or project | 23 Oct | test |
| W2 | Organization, never company; How to work, never remembered; Download, never export; Delete, never remove; Decline or Cancel, never "not now"; Decline, never Veto; a run that did not finish is Failed, in Activity's filter and every pill | 25 Oct, 1 Nov | test |
| W3 | No line for what Alpha can't do yet; a line that can't act now stays greyed with its reason; never "Coming soon" | 26 Oct | test (words) |
| W4 | Sentence case for labels, buttons and placeholders | 25 Oct | test |
| W5 | Dates read "25 Oct" (the year only when it isn't this one), typed as words; never a dd/mm/yyyy picker | 26 Oct | — |
| W6 | Plain words: no tool names, no ids; the window never names the apps it learned from | 25 Oct | — |
| W7 | Today, this month and a day's name (Home's due today, Usage's month, a backup's and a download's name, a table's earliest and latest, what is ahead for a person) are the person's own day, never UTC's | 1 Nov | test |

## Look

| # | Rule | Date | Held by |
|---|---|---|---|
| L1 | Colours and sizes are the tokens in `app.css`, nothing written out | 20 Oct | test |
| L2 | Seven text sizes, a 14px body, 12px sentence-case labels; nothing in capitals | 26 Oct, 2 Nov | test (seven sizes) |
| L3 | Serif for page, record and section titles and big numbers only | 26 Oct | test |
| L4 | Scrollbars thin, a 4px thumb shown while the box is under the pointer; a row of tabs shows none | 26 Oct | — |
| L5 | One avatar for people and organizations | 25 Oct | — |
| L6 | Every button changes colour under the pointer, into the accent's tint (the primary darkens); a soft kind is a way onward that is not the screen's main act (Open page) | 2 Nov | — |
| L7 | A card's buttons sit at its right, its main act at the right edge, the same on every card | 2 Nov | — |
| L8 | Cuts of one list are rounded buttons, each with its count, one picked (Activity's All and Failed) | 2 Nov | — |
| L9 | Where a link goes shows at the window's foot while the pointer rests on it: a place in Alpha by its name, an outside page by its address; a link to a place in Alpha opens in Alpha | 2 Nov | — |
| L10 | Files are added in one drop zone, a dashed box to drop on or click, what is there inside it | 2 Nov | — |
| L11 | Read now and Run now say when it last happened just before the button, the full time on hover | 2 Nov | — |
| L12 | A double-click on what can't change says why, at once | 2 Nov | — |
| L13 | A row's and a task's title on its page is renamed by a double-click; a module's and a table's name from its menu (S4, T19) | 2 Nov, 7 Nov | — |
| L14 | A task, a run, a person, a row, a schedule, a rule and the rows a figure counted open beside the page from a link to them; a link inside the panel replaces what it shows, with no Back; what was clicked stays in sight to the panel's left; Open page is a large soft button across the panel's foot | 2 Nov, 9 Nov | test (opened) |
| L16 | A side panel reads as lying over the page: a firmer edge and a soft shadow cast on it | 2 Nov | — |

## Proposed, waiting on Kenil or the core

- Undo of one change from a cell's History (the core reverts a line since 26 Oct; the cell's menu waits).
- A module's files listed under it, renaming a module and choosing its icon (needs the core).
- What each run costs, shown under Settings › Model (needs the core).
- A choice column's default for everyone, and flagging a cell as wrong (needs the core).
- Fewer explanatory sentences on screens, redone on today's screens.
- On a phone, a bottom tab bar with modules and chat as drawers.
