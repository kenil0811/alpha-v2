# 27 October 2026: summaries and tags (core step 3c)

A new field kind, `summary` (kit API, connector SDK and the core alike): a row's count, or the sum,
least, most or latest of one field, of the rows of another table that point at it through a
relation to one row, where at most one condition holds. It has no column and is never written: the
record store works it out with one grouped query per summary when its table is read
(`records/summary.ts`), the model reads it as a sub-select in the table's view, and its provenance
is computed with what it is in words ("Sum of Amount in Invoices, where Paid is No"). A count or a
sum of none is 0, a money sum in the currency most of its amounts are in; amounts in two
currencies are not added together. The condition is a view filter's rule (`filter-sql.ts`), and
both it and the window's own filter answer the same cases (`filter-cases.ts`, tested on each side).
It is refused over a summary, a list, notes, a row, a person or a file, through a list relation, or
with an op its field doesn't take; removing the table or field it reads removes it too, and the
removal's words say so; a relation it goes through can't become a list. Kits declare it by names
(`summary: { of, through, op, field, by, where }`) and the installer adds summaries after every
table has its relations; `kit check` checks the names; `module.yaml` mirrors it by names.

A choice can hold several (`many`, tags): a JSON list in its one column, each choice once, one
alone given becomes a list; the model reads it with `json_each`; a choice that held one becomes a
list of it (the shape tool's new `many` action, and a kit's newer version). The window shows tags as
chips, picks them from a tick list (cell, panel, add a row, form, set on many rows), filters them
by has any of, all of and none of, and keeps them off a board's columns and groups; + Add a field
offers them. A summary shows as the kind it comes to, is never typed, and says what it is on its
column and in its menu. `setChoices` no longer drops a field's other options (it lost `indexed`).

Journey `what-each-client-owes` passed first time: asked to show what each client still owes,
Alpha made a summary, and paying an invoice changed it with nothing else written.
