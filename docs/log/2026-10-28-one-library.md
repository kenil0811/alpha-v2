# 28 Oct: one window for DealPilot and the Dell prototypes, on one library

The Dell prototypes' window work (made on its own copy since 27 Oct) is brought onto this branch,
so DealPilot (4701) and the Dell roles (4767–4769) run one window. Where the two differed, Vikas
chose: Home's one strip across modules, the tinted Open page in the panel's head, and the row's
page with its document at the centre and its parts grouped beside.

New in `window/src/ui/`, each on the parts page: the pill switch (now also Intelligence; the
underlined tabs are gone), the list view as Settings draws it (Settings, Conversation, Governance,
a table's List view), cut buttons (Tasks, saved lists, Usage's days, Activity), and the drop zone
taking one kind of file (installing a connector or a module). The folded rail and assistant show
each icon with its name under it. Section headings are in sentence case.

The proposed rules in `docs/ui-rules.md` are one list now, with the library as a table. Nothing is
committed; for Kenil's look. Open: Vikas's 18, 14 and 10 as the only text sizes (10 is under the
12px floor), and the card labels still in capitals ("Maybe the same").

Later the same day: text in five sizes (10, 14, 18 body, 24, 32) with a 5px spacing step and
nothing in capitals; any click on a row, agent, run, rule, task or person opens it first in one
side panel (`Peek.tsx`), editable, with a large Open page at its foot; empty groups are not shown
and an empty state with a next step is a button; every open task has Start, Done or Review; the
vocabulary list grew (Needs approval, Possible duplicate, Failed, Clear filters, Restore,
Related, active) and the core's duplicate card says "Possible duplicate"; square icon tiles
(`ui/icon-tile.tsx`) pin up to 12 places atop the rail (Home, Conversation, Tasks, Network to
start; the layout keeps them as `docked`) and put a module's actions atop its Overview's column.

Last: nothing pinned atop the rail to start, with a task asking which to pin once modules pass 12;
Conversation is called Agents on the rail; Intelligence leaves the rail for a brain icon beside
Settings, opening the Second Brain on a graph of modules, their tables and agents, the connections
and the links between modules; Governance and Connections are in Settings (Connections stays in the
Second Brain too); rail and header text one step up; an organization chart on Team's Overview.

Then: every link opens (link, email and phone values, addresses in words, linked rows, Related),
and one Back at the left of every header. A write-up of the batch for Kenil is in Claude Docs.
