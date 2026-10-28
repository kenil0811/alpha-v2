# 27 October 2026: the builder's walls (core step 3e)

A module has a business case: who it is for, what it keeps track of, and the decisions it serves,
with whose words they are (the kit's, Alpha's shown as assumed, or the person's, which stand over
both). It lives in the module's own module.yaml, kept through every rewrite of the file, so it
travels with Make this a kit and an archive. Alpha reads it at the top of each module in every
start layer; Agents and notes shows it first, with Edit, and the person's words are theirs from
then on (a kit's update gives way to them). Kits declare it under `business_case`; `kit check`
notes a missing one and refuses nothing for it; Network 0.3.3 and Alpha's own kit 0.3.1 have theirs.

The shape tool has three walls (`engine/tools/walls.ts`), each refusing in words that say what to
make instead: a module's first table needs its business case, given with it (a new action,
`business_case`, sets or changes one); a table whose fields, notes aside, are one text field is a
choice on the table that would point at it; a table made or renamed with a period in its name (a
month, Q1 to Q4, H1, H2, a year, "Week" or "FY" with a number, as a whole word) is one table with a
date on each row. The period words and patterns are in `core/config/words.yaml`.

Running every journey found the name-only wall refusing "a table Clients with a Name"
(`a-note-on-a-row`) and "Deals with a Name" (`parts-of-a-deal`): a thing of its own, not a list of
names, and Alpha stopped to ask. Its words now tell the two apart: a list to pick from becomes a
choice; a thing the person keeps is made with what it keeps beyond its name (Clients came with a
status, an email and a since), assumed and said. A refused revert in a journey now fails that
journey instead of stopping every journey after it.

Journey `the-builder-asks-why` failed on the code before (no business case; Industries made as a
table of its own) and passes now: October became an Expenses table with a date and a view, the
industries a choice on Businesses, and Alpha answered what the module is for from its case.
