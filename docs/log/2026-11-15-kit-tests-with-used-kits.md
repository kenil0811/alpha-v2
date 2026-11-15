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

Then, on the Mac, the CRM's update to the version that uses the other kit was refused at its first
run: "may not read Deals: it is neither CRM's own table nor one its kit uses". A kit update never
copies module.yaml (it is the module's own, rewritten from its shape), and only the kit's sites
and `people` were carried into it, so a kit that came to use another's tables kept none, and its
version stayed the one first installed. On Kenil's yes, an update now carries the kit's `version`
and `uses` into the installed module.yaml (`takeUses` in `modules/kits/install.ts`), `uses`
removed when the kit drops it; a test in `modules/kits.test.ts` holds both.

The look then found the window could not open a related row from an opened row: the CRM deal's
Listing showed the listing's name as plain words inside the field's button. In an opened row a
related row's name is now a link to it (`#/row/<id>`), which opens it beside the page; a field
holding such links is a focusable group, not a button, keeping its double-click, right-click, F2
and the menu key (T4). Seen in WebKit: the deal's Listing opened the listing beside the board, and
the listing's own page names the deal under Linked here.
