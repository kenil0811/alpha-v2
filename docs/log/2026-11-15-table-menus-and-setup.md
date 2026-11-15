# 15 Nov 2026: a table's menus, related rows, and Setup

Six asks from Kenil's look at a client's module.

- **No showing line over a filtered list.** "Showing 483 of 1127 rows, filtered by …" with Clear
  filters is gone: the chips and the count beside them already say it. The line stays only for
  rows a page or a row sent the person to, with Show all, which nothing else says (T1).
- **A column's menu holds acts only.** The paragraph on what the column means and whose sentence
  it is left the menu (it is on the header's tip); the way to write one is the last item, Add
  column description, Edit column description once the person wrote theirs (T21).
- **Every menu item has an icon and no label ends in dots** (L15): the column menu, a table's ⋮,
  the lists, the footer's totals, a module's menu in the rail, the fields a filter or a group is
  picked from (each its kind's icon, `table/KindIcon.tsx`); Always, Add new, Set, Move to and
  Delete lost their dots. A task's state picker and the pickers of rows and models are values, not
  acts, and stay as they were.
- **A column of related rows or people filters and groups** (T22). It was classed with the kinds
  that can only be empty or not, so Sources offered just that; and the column's own menu barred
  grouping by a field holding several, though ⋮ › Group allowed it. It is now its own family:
  is any of and is none of, ticked from the names in the column with their counts, contains and
  doesn't contain; it groups by the names, several together when a row names several. A rule
  keeps names, as a choice's does, so a kit can write one.
- **Setup is schedules, then every table**, the module's own tabs included, and a link, Module
  details. Where the module comes from, what it is for, the agents it brings, its notes, what is
  the person's and Pack it moved to that page, under Setup (`#/module/<id>/details`, ‹ goes back
  to Setup) (M2). After his second look the table list lost its words too: each table is a name
  that opens it and its count of rows; Keep as a tab stays on the table's own ⋮ menu.

The rail's file lost its module menu to `ModuleMenu.tsx` and is under the wall; the totals a
column takes are one part for its menu and the footer.

Seen in WebKit on the Mac's Alpha, dark: no line over a filtered list; the column menu with its
icons and the description item last; Sources filtered by two names and by "account", and grouped;
Setup's two parts and the details page with Back to Setup.
