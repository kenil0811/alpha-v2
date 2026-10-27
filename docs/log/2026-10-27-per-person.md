# 27 October 2026: one row per person, and merging rows (core step 3d)

A person field can say `per: person` (kit API, kit check, the builder's new `per` action and
module.yaml alike): its table holds one row for each person. A second row for someone, a row with
no one, or a change of person onto someone who has a row is refused in words; a land finds the
person's row when its key finds none, so an agent never makes a second; setting `per` on a table
with rows folds the rows that share a person, on one line. Network 0.3.2 marks Closeness so.

Every merge of two people now writes one `folded` line (`records/fold.ts`, called from the people
store's merge): every person field naming the merged-in person names the kept one, in any table,
which fixes Closeness skipping the Members of someone merged in (a script's `rows.list` gave the old
id, `people.list` only kept people); in each per-person table their rows fold into the kept
person's by the agreed rules, with a card where two values of the person's own differ (its pick is
theirs, sourced to the card); what pointed at the folded row, its files and its tasks move to the
kept row; the folded row goes to the trash. Unmerge reverts that line with step 1's undo (a new
`unfold` option; nothing else may revert a fold, and the revert it writes is not offered again);
where the folded row is gone for good, what it held stays where it went, and the words say so.

People's grid shows the fields of its module's one-row-per-person tables after its own columns,
and a person's page a section for each (the row view's field list, now its own component); a value
typed there writes the person's row, made if need be. The model's `people` view gets the same
columns. The module mark reader (`people: true`, `core: true`) moved into the world, beside
module.yaml's writer.

Journey `a-merge-folds-a-person` failed on the code before (two Closeness rows, a Members row
under the old id) and passes now.
