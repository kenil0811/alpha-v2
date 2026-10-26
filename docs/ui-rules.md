# The window's UI rules

Every rule Vikas has set for the window, one line each. Read this before any change to `window/`;
a new rule from Vikas goes here the same day, with its date. Where two rules disagree, the newest
dated word wins and the older one is dropped from this list; what is still open is under "To settle".

**Held by** names the test in `window/src/look.test.ts` that fails when the rule breaks: **test**
holds it today, **todo** is written but skipped until the fix lands (turn it on in the same PR),
**—** cannot be checked by code and is held by review. Dates are 2026 unless they say otherwise.

## Shell and rail

| # | Rule | Date | Held by |
|---|---|---|---|
| S1 | The rail is module names only: Home, Conversation, Tasks, then each module, with modules inside one folded under it | 20 Oct | — |
| S2 | Intelligence and Settings are pinned at the bottom of the rail, Intelligence above | 25 Oct | — |
| S3 | The top of the rail says Workspace, never Organization | 25 Oct | — |
| S4 | Modules share one icon set (rail, folded rail, Home, Find) | 25 Oct | — |
| S5 | A module's menu in the rail: Rename, Change icon, Hide, Hidden modules; double-click a name to rename | 25 Oct | — |
| S6 | Both side panels drag by one edge, fold when dragged all the way in, and keep their widths | 25 Oct | — |
| S7 | The rail folds to a strip of icons (⌘\\); Escape steps the assistant back | 25 Oct | — |
| S8 | People and Organizations are Network's first two tabs; Network lights in the rail | 25 Oct | — |
| S9 | Menus sit against the window (fixed), never clipped by a scrolling box | 30 Aug, kept 25 Oct | — |
| S10 | Heights use `dvh`, never `vh` (the phone's browser bars) | 2 Sep | todo |

## Header bar

| # | Rule | Date | Held by |
|---|---|---|---|
| H1 | One bar, one height across the rail's top, the page and the assistant | 25 Oct | — |
| H2 | A way back on the left; the screen's switch centred, or its name in serif when it has one page | 25 Oct | — |
| H3 | A switch lives in the header, never as a second row | 25 Oct | — |
| H4 | Tabs never truncate: names whole, or icons only when narrow, never "P…" | 26 Oct | — |
| H5 | No Find box in the header; ⌘K still finds | 26 Oct | todo |

## Module page

| # | Rule | Date | Held by |
|---|---|---|---|
| M1 | A module opens on its first page; there is no separate module detail page | 25 Oct | — |
| M2 | Files, Intelligence and Governance sit below every module's data, Network's People and Organizations included | 26 Oct | — |
| M3 | Files: search, upload, icons or details, and an item count | 26 Oct | — |
| M4 | Governance: Allowed n and Denied n, with + Add; each rule editable, with its why and Delete (needs core) | 25 Oct | — |
| M5 | New module opens a blank module page with a field to describe it; Alpha builds it from there | 25 Oct | — |

## Table and toolbar

| # | Rule | Date | Held by |
|---|---|---|---|
| T1 | Toolbar: saved list, view, search on the left; Filter, then ⋮, on the right | 26 Oct (first said 9 Oct) | todo |
| T2 | Metric tiles sit below the toolbar row, never above | 26 Oct | todo |
| T3 | No collapse chevron in the toolbar, no squeezed "‹" back crumb | 26 Oct | — |
| T4 | Columns live inside ⋮ ("View options · n hidden"), not as a toolbar button | 26 Oct | — |
| T5 | Add column is one button at the table's corner, not also in ⋮ | 26 Oct | — |
| T6 | New is a button in the pagination row, and works while the assistant is open | 26 Oct | — |
| T7 | A click on the name (first column) opens the record; a double-click edits | 26 Oct | — |
| T8 | Double-click changes a value in place, and a saved list's name | 25 Oct | — |
| T9 | An empty table keeps its header, blank rows, add row and footer, and says nothing | 26 Oct | — |
| T10 | One count of rows, said once | 26 Oct | — |
| T11 | The view menu offers what the data supports; the rest stay, greyed, with the reason | 26 Oct | — |
| T12 | Right-click opens the same menu as the ⋮ beside it: one list, never a second | 25 Oct | — |
| T13 | The overflow glyph is the vertical ⋮, everywhere | 25 Oct | test |
| T14 | Rows come 25, 50, 100 or 250 a page, kept, with First and Last | 25 Oct | — |
| T15 | Ticked rows: "n selected" bar; Escape lets go of them after closing any menu first | 25 Oct | — |
| T16 | Every dropdown is one of ours: search past five, ★ on hover sets the default, "Add new…" pinned at the bottom | 25 Oct | — |
| T17 | No bare `<select>` where a person picks; only the cell editor keeps the native one | 25 Oct | test |
| T18 | Cell history: who, old → new, Undo, on right-click and in a record's ⋮ | 26 Oct | — |
| T19 | Paste across cells; ⌘D fills down | 26 Oct | — |
| T20 | Flag a cell as wrong in red; saved lists shared with others (both need core) | 26 Oct | — |

## Record page

| # | Rule | Date | Held by |
|---|---|---|---|
| R1 | Every record page has one layout: the way back in the bar, a centred column, a line naming the record, its serif title, its sections | 25 Oct | — |
| R2 | Delete is never one click: behind ⋮ or hover, always confirmed, saying what goes | 26 Oct | — |
| R3 | Confirmations are our own pop-up, never the browser's `confirm`, `alert` or `prompt` | 25 Oct | test |
| R4 | A refusal shows in a line beside the control that was pressed, never dropped | 25 Oct | — |

## Assistant and chat

| # | Rule | Date | Held by |
|---|---|---|---|
| A1 | The assistant's header: fold, face and name only; no Expand, no Open whole conversation | 26 Oct | todo |
| A2 | The composer's "+": attach, the model, other options; the model shows there, nowhere else | 25 Oct | — |
| A3 | Question cards answer in one tap; a card's Yes and No read Approve and Decline | 25 Oct | test (words) |
| A4 | Every icon button has a label, read aloud and shown as one quick tooltip of ours | 26 Oct | test (label); todo (tooltip) |

## Intelligence

| # | Rule | Date | Held by |
|---|---|---|---|
| I1 | Tabs: Connections, Agents, Second Brain | 26 Oct | — |
| I2 | No Modules section; installing and updating modules lives in Settings › Modules | 26 Oct | — |
| I3 | Every row opens something; an agent opens its own page | 26 Oct | — |
| I4 | Second Brain is a graph by default, coloured by type with a legend | 25 Oct | — |

## Settings

| # | Rule | Date | Held by |
|---|---|---|---|
| G1 | Sections listed on the left, one shown at a time | 25 Oct | — |
| G2 | Permissions live in Settings | 26 Oct | — |
| G3 | Models: one row per provider with its sign-in state, a key field (•••• last four), Save and Delete, ★ default | 25 Oct | — |
| G4 | Subscription: usage and when it resets (needs core) | 25 Oct | — |

## Wording

| # | Rule | Date | Held by |
|---|---|---|---|
| W1 | Module, never kit or project | 23 Oct | test |
| W2 | Organization, never company; Second Brain, never remembered; Download, never export; Delete, never remove; Decline or Cancel, never "not now" | 25 Oct | test |
| W3 | Decline, never Veto | 25 Oct | test |
| W4 | A control that can't act stays, greyed, with the reason on hover; never "Coming soon" | 25 Oct | test |
| W5 | Sentence case: labels, headers and buttons; no letter-spaced capitals. Held: Kenil's look on main (26 Oct) differs; waiting on his answer (11px capital labels) | 25 Oct | held |
| W6 | No explanatory sentences on a screen; a description is a short phrase in a tooltip | 26 Oct | — |
| W7 | The window never names the apps it learned from | 25 Oct | — |
| W8 | Plain words: no tool names, no ids | 20 Oct | — |
| W9 | Dates absolute, as "25 Oct"; never a dd/mm/yyyy picker | 26 Oct | — |

## Look

| # | Rule | Date | Held by |
|---|---|---|---|
| L1 | Colours and sizes are the tokens in `app.css`, nothing written out | 20 Oct | test |
| L2 | Seven text sizes; body 18px. Held: Kenil's look on main (26 Oct) differs; waiting on his answer (14px body) | 25 Oct | test (seven sizes) |
| L3 | Nothing under 12px. Held: Kenil's look on main (26 Oct) differs; waiting on his answer (11px labels) | 26 Oct | held |
| L4 | Headings 50% larger: 27px | 26 Oct | todo |
| L5 | Serif for page and record titles only; section titles plain. Held: Kenil's look on main (26 Oct) differs; waiting on his answer (serif section titles) | 25 Oct | — |
| L6 | Every section is a card with a plain title; an empty one is a dashed card. Held: Kenil's look on main (26 Oct) differs; waiting on his answer (no cards) | 25 Oct | — |
| L7 | One avatar for people and organizations | 25 Oct | — |

## To settle

1. **Folding the tiles.** T3 drops the chevron that folded the metric tiles. Do the tiles fold another way (⋮), or always show?
2. **What New opens.** T6 puts New in the pagination row. Does it add a blank row in place, or open a new record's page that writes nothing until Save?
3. **Network's ten tabs.** With the assistant open at 1440 they show as icons only (H4). Fewer tabs (two) brings the names back: go ahead?
4. **Wide screens.** Keep tab names by narrowing the assistant, or are icons fine?
5. **Design §14 still says otherwise** on A1 (the assistant expands to half or opens whole), I1–I2 and G2 (Intelligence and Settings' contents), and H5 (Find in the header). The rules above are Vikas's newest; the design changes on Kenil's yes.
6. **Still to check before they become rules:** ⌘K finds records and offers "Ask Alpha: …"; the assistant shows its steps and a timer while working; a metric tile opens a bigger chart and its rows; on a phone, a bottom tab bar with modules and chat as drawers.
