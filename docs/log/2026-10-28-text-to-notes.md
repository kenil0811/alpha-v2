# 28 October 2026: a text field becomes notes (core plan step 4, a client's kit)

A kit's newer version may declare `kind: notes` on a field its installed copy holds as text: the
update turns that field into the table's notes, keeping its id, its column and every value, so
each row's text is now its notes, out of the grid and the model's table view and in `row_notes`.
It is the one change of kind there is (`toNotes` in `world/shape/fields.ts`, journaled as
`shaped`); a field of any other kind, a second notes field on a table, or a text field a summary
reads is refused in words. The design's line on shape changes says so.

It came from a client's kit reshaped into the places of step 3 (its plan accepted by Kenil the
same day), whose deals kept the person's notes as a plain text field. Test
`world/notes-kind.test.ts` turns one through a kit update; `pnpm check` passes.
