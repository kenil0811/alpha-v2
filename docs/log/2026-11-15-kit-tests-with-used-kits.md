# 15 Nov 2026: a kit's tests with the kits it uses

A client's CRM kit now uses the tables of a second kit of theirs and only reads them. Its tests
could not run: the runner installed the kit alone, and the install refused it for the kit it uses.
`pnpm kit test` now installs the kits a kit uses first, each from the folder beside it whose
module.yaml names it (and the ones those use), so a case can seed their tables too. A later run
(`then`) can also do what the person did before it, as the window does: `change` types values over
a row found by its values (stated, with the person's words, rules A1), and `remove` removes rows.
That is how a test shows a typed value staying the person's and a removed row staying removed.
Two runner tests hold both (`core/src/modules/kittest.test.ts`). Done without asking, to test the
client's step; said to Kenil.
