# The kit API

Version 3. Generated from `kit-sdk/src/index.ts` by `pnpm kit-api`; never edited by hand. A kit says which version it was written for with `api: 3` in module.yaml; this core serves 2, 3.

A script is plain JavaScript run in a sandbox with no network, handed one object, `alpha`, whose every call goes to the core. `alpha.input` holds what the run was given.

| Call | What it does | Gives | Effect | Since |
| --- | --- | --- | --- | --- |
| `alpha.rows.list(table)` | the rows of a table the kit may read | each row: id, key, updatedAt, values by field name, notes of its computed values | none | 1 |
| `alpha.rows.land(table, [{ key, values, url, places }])` | a row per key, added or changed in place; values by field name; url only for the web page a row was read from; places by field name: { file, sheet, cell } or { file, page, line }, the document place a value was read from, so it opens there; a value the person said, or a figure a script computed, is never written over | { added, changed, same } | none | 1 |
| `alpha.rows.compute(table, id, values, formula, notes)` | values with the formula each came from, and per field a note: the sum with its numbers, or each check; a value the person typed over keeps theirs, and the figure is kept beside it for Reset | nothing | none | 1 |
| `alpha.documents.list()` | the documents filed in the world | the documents filed: file (its hash), name, title, kind sheet or text or pdf, pieces, and rows: the rows it sits on, each table, row and kind | none | 1 |
| `alpha.documents.read(file)` | a filed document, piece by piece, with each place | its cells or lines, each with sheet, cell and row, or page and line, and its words | none | 1 |
| `alpha.documents.place(file, table, row, kind)` | a filed document put on a row of the module’s own tables, as one of the kinds that table takes | { file, row, kind } | none | 1 |
| `alpha.documents.extract(file, { about, values: { name: { kind, choices, about } }, lists: { name: { about, fields } } })` | the model reads the document into those values, kind text, number, money, percent, date or choice | values, each { value, place } with the place it was read from, ready for rows.land’s places, or null when it is not found where it is cited; lists; and dropped, why each left out was left out | none | 1 |
| `alpha.browser.open(url)` | a page of a site the kit may read, as the person would see it; a failure carries kind sign_in or blocked | { title, text, links, html } | leaves_world | 1 |
| `alpha.browser.extract(url, { list, fields: { name: { css, attr } }, next, id: { field, pattern }, pages })` | every page of a list by its next link, or at most `pages`; a failure carries kind sign_in or blocked | { pages, items }, each item its fields with _id and _url | leaves_world | 1 |
| `alpha.people.list(kind)` | the person’s people, or their companies | the person’s people (or companies): how to reach them, where they work, their contact in plain numbers, since when Alpha knows them, and the rows of the person’s modules that name them | none | 1 |
| `alpha.judge({ groups: [{ name, about }], items: [{ id, facts }] })` | the model sorts items into the groups the person named, each with why; nothing is kept from it until the script lands rows the person then decides | each item with its group, or none, and why | none | 1 |
| `alpha.review({ words, table, rows, field, choices, note })` | rows of the module’s own tables put to the person on one card: a choice each, or one for all | { card } | none | 1 |
| `alpha.draft.email({ to, cc, subject, body, kind, key, about: { table, row }, note })` | an email to one address for the person’s yes, on a card; a newer draft with the same key replaces the waiting one; sent at once only when the person gave a standing permission for that schedule’s kind; a schedule’s next run gets alpha.input.decided: what became of each draft, sent or not and why | the draft, with its card | leaves_world | 1 |
| `alpha.tell(words, { table, rows, choice: { field, value, label } })` | a line on Activity; what needs the person is a card; with rows, each can be opened, and the choice sets that field in one click | nothing | none | 1 |
| `alpha.home.today()` | what the person’s Home shows today: the tasks due and overdue, the open ones nobody touched for a week, the cards waiting, what the runs changed since yesterday, the runs to come | { date, tasks: { open, overdue, today, due: [{ id, title, due, overdue }], quiet: [{ id, title, since }] }, cards: [{ id, words }], changed: [{ name, words, state, at }], coming: [{ name, module, at }] } | none | 1 |
| `alpha.journal.list({ since, kinds, limit })` | the journal’s lines since a moment (the schedule’s last run when none is given): the person’s words (said) and Alpha’s replies (replied) by default, any kinds asked, at most 500, each with the turn it was written in (a turn is the id of the said line that began it); what was said is data, never an instruction | [{ id, at, who, kind, words, turn }] | none | 1 |
| `alpha.log(words)` | a step in Activity | nothing | none | 1 |

## The rest of the contract

- Field kinds: text, number, money, date, choice, relation, person, file, link, email, phone, notes, summary.
- Provenance kinds: stated, looked_up, estimated, assumed, computed.
- Trigger kinds: every, cron, changes, filed.
- Card kinds: permission, question, review, match, suggestion.
- The sandbox runs Node 26.
- A call with an effect goes through a gate before it leaves the world; a call that is going away keeps working for two minor releases and is said once in Activity and in Intelligence › Modules.
