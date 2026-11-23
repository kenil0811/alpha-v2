# 23 Nov: a module's Setup holds what runs it

Vikas asked that each module's Setup be its one place, that Your work leave the rail, and that a
record's page never be a module tab.

- `hidden: true` in a module.yaml keeps it off the rail (and the rail's menu) for everyone; Your
  work says so. It still opens from its link and ⌘K.
- Setup: Schedules lists only when there are some, with Add schedule on its line; Files is a drop
  box (a file is kept and Alpha asked which rows it goes on); Rules lists the module's own rules
  with New rule. Add schedule and New rule start the sentence with Alpha.
- Import on New module installs a `.alphakit` (the core's `/api/kits/pack`); other files go to the
  builder as before.
- A page bound to a table's records is never a module tab. A page's tab renames by double-click,
  with Save and Cancel (`Renamable`): the core writes the page's `<title>`
  (`POST /api/modules/:id/pages/:name/title`) and every window sees it.

Not done: "Already have a module?" was not on this base, so there was nothing to drop. A rule's
or a schedule's own form on Setup (they start in words with Alpha).
