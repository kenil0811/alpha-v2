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
| S1 | The rail is module names only: Home, Conversation, Tasks, then each module, with modules inside one folded under it; Alpha's own module is not there | 20 Oct, 26 Oct | — |
| S2 | Intelligence and Settings are pinned at the foot of the rail, Intelligence above | 25 Oct | — |
| S3 | The rail's head is the workspace: a menu of Settings, Intelligence and Appearance | 26 Oct | — |
| S4 | A module's menu (⋮ or right-click): Open, Move to, Hide, Hidden modules; modules drag into one another or out to the top | 26 Oct | — |
| S5 | How the person left the window (the rail's width, folds and hidden modules, the assistant, rows to a page) is kept per person by the core, never in the browser | 26 Oct | — |
| S6 | Both side panels drag by one edge and fold; the rail folds to a strip of icons (⌘\\) | 25 Oct | — |
| S7 | Menus sit against the window, never clipped by a scrolling box; what floats over the page takes a name on one layering scale (raised, panel, overlay, pop, tip), a box keeps its own order with z-0 to z-3 | 25 Oct, 1 Nov | test (layers) |
| S8 | Heights use `dvh`, never `vh` (a phone's browser bars) | 2 Sep | skip |

## Header bar and tabs

| # | Rule | Date | Held by |
|---|---|---|---|
| H1 | One 48px bar across the rail's top, the page and the assistant: a way back to where you were on the left (the screen last visited in this window, by its name; a tab switch inside a screen is not a place; nothing visited, the screen's parent), the screen's name centred | 25 Oct, 1 Nov | test |
| H2 | A screen with parts has one row of tabs under the bar, every label in full, scrolling sideways; never cut short or folded to icons | 26 Oct | — |
| H3 | No Find box in the bar; ⌘K finds anywhere | 26 Oct | test |

## Home

| # | Rule | Date | Held by |
|---|---|---|---|
| O1 | Home is the important things: the date, the greeting and one line to ask Alpha; what needs the person, each card answered there; Overdue, Due today and This week as tiles (Overdue red only when it has some); what changed since they last looked, kept until they clear it; what is running; each agent's next run | 20 Oct, 26 Oct | — |
| O2 | No modules on Home (they are in the rail); the conversation is the assistant beside it, never in Home's own space | 26 Oct | — |

## Module page

| # | Rule | Date | Held by |
|---|---|---|---|
| M1 | A module's tabs: People and Organizations where its module.yaml says so, its pages, its main tables with their counts (a table part of a row, setup, or one row per person in People's module is not a tab), then the parts and setup tables kept as tabs, Conversation, Agents and notes | 26 Oct, 27 Oct, 28 Oct | — |
| M2 | Nothing sits under a table or a page; what the module is for (its business case, Edit beside it, assumed while Alpha's), agents, the module's other tables (setup, and parts with what they are part of, each with Keep as a tab, reading A tab while it is one; the same in the table's ⋯ menu), notes, recent activity and Governance are the Agents and notes tab | 26 Oct, 27 Oct, 28 Oct | — |
| M3 | Governance shows only rules the core holds and enforces, Allowed and Denied, each saying where it came from; + Add starts the conversation; a rule of yours has Revoke behind ⋮, one Alpha noticed Approve and Dismiss | 26 Oct, 27 Oct | — |
| M4 | New module opens a page: a name, what it keeps track of, Build it asks Alpha | 26 Oct | — |

## Table and toolbar

| # | Rule | Date | Held by |
|---|---|---|---|
| T1 | One toolbar line: saved list, view, Search, Filter on the left; Columns and ⋮ on the right; Save and Cancel only while the list differs from its saved self. Whenever rows are hidden, a line under the tabs says how many show and what hides them ("Showing 12 of 140 rows, filtered by Stage and a search"), with Clear filters; Cancel brings the saved list back | 26 Oct, 1 Nov | test (the line) |
| T2 | No cards of counts above or below a table | 26 Oct | test |
| T3 | New sits in the page row under the table and works while the assistant is open | 26 Oct | — |
| T4 | A click on a row's name opens it in the side panel, with Open page to its own page (#/row/…), beside the assistant too when the window holds the rail, the page's 600px, the panel's 320px and the assistant (else the panel gives way and the assistant stays); a link to a task, a run, a person or a row opens it beside the page the same way, kept in the address so a reload keeps it and Back closes it, one view in both: fields, notes, its parts as small tables with New, Linked here, files, tasks; a double-click edits a value, in the grid and in an opened row. A part's small table: its first three fields, one line a row, names never ids, long words cut with the whole on the tip; its twelve changed most lately with how many in all, and Open as a table for the rest | 26 Oct, 27 Oct, 28 Oct, 1 Nov | test (room, beside) |
| T5 | An empty table keeps its header, blank rows and footer, and says nothing | 26 Oct | — |
| T6 | Every menu works from the keyboard and opens on a right-click where it belongs; one list, never a second | 26 Oct | — |
| T7 | The overflow glyph is the vertical ⋮ | 25 Oct | test |
| T8 | Rows come 25, 50, 100 or 250 a page, with First and Last | 25 Oct | — |
| T9 | Ticked rows show "n selected"; Escape lets them go after any menu closes | 26 Oct | — |
| T10 | Every dropdown is one of ours: search past five, Add new… at the foot where a choice can grow | 26 Oct | — |
| T11 | No bare `<select>` where a person picks; only the cell editor keeps the native one | 25 Oct | test |
| T12 | Freezing and wrapping columns are kept with the saved list, like widths | 26 Oct | — |
| T13 | A cell's History (old → new, who, when) is on its right-click menu; ⇧↓ and ⌘D fill down, after a yes | 26 Oct | — |
| T14 | A summary shows as the kind it comes to and is never typed; what it is, in words, is on its column's tip and menu | 27 Oct | — |
| T15 | Tags show as chips and are picked from a tick list; filtered by has any of, all of, none of; never a board's columns or a group | 27 Oct | — |
| T16 | People shows, after its own columns, the fields of its module's one-row-per-person tables, each named by its field (its table's name in front only on a clash); a person's page has a section for each; typing there writes that person's row, made if need be | 27 Oct | test |

## Pages, records and deleting

| # | Rule | Date | Held by |
|---|---|---|---|
| R1 | A section is its serif title and ⓘ over what it holds, never a card; nothing sits in a card inside a card | 26 Oct | — |
| R2 | One record layout: the way back in the bar, a centred column, a line naming the record, its serif title, its sections; a row's page too | 25 Oct, 27 Oct | — |
| R3 | Delete is never one click: behind ⋮, or a short list's ✕ (R8), always confirmed in our own pop-up, saying what goes, the parts that go with it, and how long Bring back returns them, in the core's words | 26 Oct, 27 Oct, 1 Nov | — |
| R4 | Never the browser's `confirm`, `alert` or `prompt` | 25 Oct | test |
| R5 | A refusal shows in a line beside the control that was pressed | 25 Oct | — |
| R6 | Revert, and Bring back on a removal, sit behind an Activity line's ⋮, said first in the one pop-up from the core's own preview of the same work | 26 Oct | — |
| R7 | A value Alpha is not sure of has a small grey mark (≈ estimated, ? assumed), never amber: its word on hover in a table, written out in a panel; an empty value is a grey dash in a table and "Unknown" in a panel | 25 Oct | — |
| R8 | A short list (How to work first, the others as they are touched): Add on its heading, ✕ on an entry when hovered, a double-click edits the entry in place (Enter keeps, Escape puts it back); where Alpha must understand an entry, Add starts the conversation | 1 Nov | test |

## Assistant and chat

| # | Rule | Date | Held by |
|---|---|---|---|
| A1 | The assistant's header: fold, face and name, the pencil, the bell; no Expand, no Open whole conversation | 26 Oct | test |
| A2 | The person's words in a light bubble on the right; Alpha's on the surface on the left, a grey line under each | 26 Oct | — |
| A3 | The composer's +: files, a folder, Model ›; @ names an agent | 26 Oct | — |
| A4 | Every icon button has a label, read aloud and shown on hover in our one tooltip, never the browser's title | 26 Oct | test |
| A5 | The assistant is the conversation on the right of every screen but the conversation's own, Home included; open unless the person folds it (⌘J or its fold) to a strip with the face and the bell; it always leaves the rail and at least 600px of screen | 26 Oct | — |
| A6 | A finished reply longer than four lines (`reply_fold_lines`) folds with More, above its first table when that comes sooner; one that opens with a table shows whole | 25 Oct | — |

## Intelligence and Settings

| # | Rule | Date | Held by |
|---|---|---|---|
| I1 | Intelligence: Connections, Agents, Second Brain (How to work, Decisions, Noticed) | 26 Oct | — |
| I2 | Settings: Model, Modules, Permissions, Data, Appearance, Help, one at a time; Experimental always, the developer switch at its top, then what is being tried | 26 Oct, 29 Oct | — |
| I3 | Settings › Model: each way on its row with its state, its key and Use this; under them Usage, a month at a time (months as a segmented control), its total "at API prices" on the subscription, then by module, by agent and by model (models by name), largest first; a run's or a turn's cost on its Activity line | 26 Oct, 28 Oct | — |
| I4 | Settings › Permissions lists every rule across Alpha, each opening its page (#/rule/<id>), in place of standing permissions | 27 Oct | — |

## Wording

| # | Rule | Date | Held by |
|---|---|---|---|
| W1 | Module, never kit or project | 23 Oct | test |
| W2 | Organization, never company; Second Brain, never remembered; Download, never export; Delete, never remove; Decline or Cancel, never "not now"; Decline, never Veto; a run that did not finish is Failed, in Activity's filter and every pill | 25 Oct, 1 Nov | test |
| W3 | No line for what Alpha can't do yet; a line that can't act now stays greyed with its reason; never "Coming soon" | 26 Oct | test (words) |
| W4 | Sentence case for labels, buttons and placeholders | 25 Oct | test |
| W5 | Dates read "25 Oct" (the year only when it isn't this one), typed as words; never a dd/mm/yyyy picker | 26 Oct | — |
| W6 | Plain words: no tool names, no ids; the window never names the apps it learned from | 25 Oct | — |
| W7 | Today, this month and a day's name (Home's due today, Usage's month, a backup's and a download's name, a table's earliest and latest, what is ahead for a person) are the person's own day, never UTC's | 1 Nov | test |

## Look

| # | Rule | Date | Held by |
|---|---|---|---|
| L1 | Colours and sizes are the tokens in `app.css`, nothing written out | 20 Oct | test |
| L2 | Seven text sizes, a 14px body, 11px capital labels | 26 Oct | test (seven sizes) |
| L3 | Serif for page, record and section titles and big numbers only | 26 Oct | test |
| L4 | Scrollbars thin, a 4px thumb shown while the box is under the pointer; a row of tabs shows none | 26 Oct | — |
| L5 | One avatar for people and organizations | 25 Oct | — |

## Proposed, waiting on Kenil or the core

- Undo of one change from a cell's History (the core reverts a line since 26 Oct; the cell's menu waits).
- A module's files listed under it, renaming a module and choosing its icon (needs the core).
- What each run costs, shown under Settings › Model (needs the core).
- A choice column's default for everyone, and flagging a cell as wrong (needs the core).
- Fewer explanatory sentences on screens, redone on today's screens.
- On a phone, a bottom tab bar with modules and chat as drawers.
