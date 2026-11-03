<!-- docs/ui-contributions.md says which lane a change takes. Can't tell? It is Lane 2. -->

## Lane

- [ ] Lane 1: the window, into `main`
- [ ] Lane 2: lab idea, into `ui-lab`

## What changes, in one sentence


## Where to look

<!-- the screen, and how to get there -->

## Before and after

<!-- screenshots in light and dark; test data only, never the ?t= address -->

## Lane 1: why the core is untouched

<!-- After this change, could Alpha save, change, delete, send or decide anything differently, or
fail, slow down or lose data where it did not before? Say in a line why the answer is no. -->

- [ ] No new or changed core work, and no new npm package
- [ ] Every button does to the data what it did before
- [ ] No confirmation, preview, refusal, waiting card or "not sure" mark removed or weakened
- [ ] The window asks the core no more often, and loads no more at once
- [ ] `docs/ui-rules.md` (and the test holding a rule) updated if a rule changed
- [ ] `pnpm check` passes
- [ ] Looked at in light and dark, big and small window, in Safari

## Lane 2: the pitch to Kenil

- Why it is better for the person:
- [ ] Window only
- [ ] Needs the core too (what):
