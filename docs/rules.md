# Alpha's rules for modules and data

These are the rules the core keeps on who may change a module, who owns the data, what the
journal proves and what must fail loudly. Each rule is one line, as agreed with Kenil. Read this
before any change to the core's world, its routes or tools, a schedule's scripts, a connector's
tables or a plugin. A rule lands here, with its date, once Kenil has said yes to it. Where this
list and `docs/design.md` disagree, the design wins and this list is corrected the same day.

**Held by** says how the rule is held:

- **test**: its test in `core/src/rules/` tries it through every door and passes.
- **skip (step N)**: the test is written, and what does not hold yet waits on the step named
  (steps of the plan in the production review, 3 Nov). A waiting door that starts to hold fails
  until its mark is taken off, in the test and here.
- **step 8**: written when step 8 starts, with Dell's contract.
- **—**: code cannot check it, so review holds it.

`pnpm rules` checks this list against the tests. Dates are 2026.

## Terms

- **Open module**: the firm's to change, within its build setting.
- **Managed module**: changed only by a newer pack signed by Kenil's key. A plugin's module is
  managed by Alpha, and a connector's module for its source fields.
- **Alpha's own table**: Alpha's row is the firm's working record.
- **Mirror**: a table of a system that keeps the record. Its connector names that system.
- **Source field**: a field on a mirror that the connector fills. **Own field**: any other
  field on it.
- **The person's value**: a value a person typed, or that the model wrote on their own words.
- **Correction**: the person's value on a mirror's source field. It is kept in Alpha and never
  sent back.
- **Door**: any way in that can change a row or a module. All of them are listed in
  `core/src/rules/doors.ts`.

## Who may change a module

| # | Rule | Date | Held by |
|---|---|---|---|
| M1 | Every module is open or managed. Only a pack signed by Kenil's key makes one managed (`managed: true` in its module.yaml). A plugin's module is managed by Alpha itself, and a connector's module for its source fields (the firm's own fields beside them stay the firm's, D7) | 4 Nov, 5 Nov | test |
| M2 | In a managed module nobody changes its tables, fields, choices, relations, schedules, skills, scripts, pages or business case: not a person, the model, a schedule or a plugin. Every door refuses in words that say who manages it; the window greys the control with that reason | 4 Nov | skip (step 8) |
| M3 | Only a newer signed pack changes a managed module. Its files are checked against the signature at every start; a changed file does not load and says what changed | 4 Nov | test |
| M4 | In an open module everything is the firm's to change. A kit's update follows the ownership rule, and a maintained kit's shape change, or a change to a file it shipped, goes on its card from every door, not only the model's tool; a file the firm adds to its module (a source's own reader) is the firm's | 4 Nov, 5 Nov | test |
| M5 | Kit code finds tables and fields by their lasting key, never by a name a person can change, so a rename never breaks a schedule or a reader | 4 Nov | test |
| M6 | Who may build is one firm setting: everyone, admins or nobody. Building is a new module, table, field, schedule or page, and installing or packing a kit | 4 Nov | step 8 |
| M7 | The developer switch (`developer: true` in alpha.yaml, out of the window since 7 Nov), installing packs, restoring, bringing in or removing data, and the model's route are for admins only (the owner, until there are users) | 4 Nov, 7 Nov | step 8 |
| M8 | A managed kit's update may rename, retype and remove, by a scripted migration signed with it; an open kit's update only adds | 4 Nov | step 8 |

## Who owns the data: Alpha's own

| # | Rule | Date | Held by |
|---|---|---|---|
| D1 | Every table is Alpha's own or a mirror. A mirror names the system that keeps its record; a field its connector does not fill is Alpha's own | 4 Nov | test |
| D2 | The person's value beats every machine. No reader, connector, script, schedule, revert of a machine's run, or the model on its own writes over it or clears it; the model changes it only in a turn on the person's own words | 4 Nov | test |
| D3 | A machine's newer value for a field the person set is kept beside theirs, with its source and time. The cell is marked ("the page now says …") and Reset puts the source's value back | 4 Nov | test |
| D4 | A row the person removed stays removed: its item key is remembered, so a reader that meets it again leaves it out. Bring back returns it | 4 Nov | test |
| D5 | A number, an amount or a date the model calls "stated" must be in the person's message or a card's answer; otherwise it lands as assumed | 4 Nov | test |

## Who owns the data: mirrors

| # | Rule | Date | Held by |
|---|---|---|---|
| D6 | A mirror's source field takes a correction kept in Alpha, never sent back. The corrected value is what Alpha shows and uses, marked "Corrected in Alpha; Gmail says …"; each read keeps the source's value beside it, and Reset puts it back. A field the connector declares writable is the exception (D10). In a managed module the kit decides whether corrections are allowed. An action that leaves the world on a corrected value uses the correction, and its card says so | 4 Nov | skip (step 8) |
| D7 | Alpha's own fields may sit beside the source's on a mirror's row (tags, notes, a link to a deal) and follow the rules for Alpha's own data | 4 Nov | test |
| D8 | A mirror's rows come and go only with the source: no remove, trash, Bring back or Revert of them in Alpha. A record deleted at the source is marked gone and kept, out of the default lists, so the notes, tasks and links on it stay findable | 4 Nov | test |
| D9 | Each mirror's connector declares what may change at the source (add, change which fields, remove), each through one named action. What it does not declare is never sent; mail, calendar, contacts and LinkedIn declare nothing | 4 Nov | test |
| D10 | A change to a declared field is a request, not a write. It goes through the declared action as a step that leaves the world (`outward`, never `write`), on a card unless an approved rule allows it. It carries the value it was based on, and is refused when the record changed since | 4 Nov | skip (step 8) |
| D11 | The row shows the request as waiting until a read shows the system took it; only then is it the row's value. Not confirmed in time, it becomes a card. Each step is a journal line | 4 Nov | step 8 |
| D12 | A mirror's row says when it was last read; an action that leaves the world on a mirror's value reads that row fresh first | 4 Nov | skip (step 8) |

## Audit

| # | Rule | Date | Held by |
|---|---|---|---|
| A1 | One journal line per change, written in the change's own transaction by the world function that makes it; no door writes a line of its own beside it | 4 Nov | test |
| A2 | Every line names a real actor: the signed-in person, a schedule with its run, a connector with its account, or Alpha's turn with the message it served | 4 Nov | step 8 |
| A3 | The chain's newest hash is written outside the world every day, into the backup's manifest and the report, so a rewritten tail cannot verify | 4 Nov | skip (step 7) |
| A4 | A line that adds, changes or lands rows carries a digest of the values it wrote, so `pnpm journal verify` finds a value changed in the file | 4 Nov | skip (step 7) |
| A5 | In a firm with users, reading a managed module's records is a journal line, folded after its days like the model's reads | 4 Nov | step 8 |
| A6 | Where Alpha asks people to sign in, every request but the sign-in pages carries a live session and acts as that person: their conversation and the cards raised in it are theirs alone, and only the owner sets the model, the data, who may sign in, and installs a pack | 9 Nov | test |

## Reliability

| # | Rule | Date | Held by |
|---|---|---|---|
| R1 | Every scheduled job that fails says so: a journal line each time, and a card on Home after two failures in a row | 4 Nov | skip (step 7) |
| R2 | A daily backup that failed, or was not made by its hour, is a card the same day | 4 Nov | skip (step 7) |
| R3 | Each rule here says how it is held; its test tries it through every door, and `pnpm check` fails when a rule and its test disagree | 4 Nov | test |
| R4 | The scenario journeys that do not wait run before any push that touches the world, and the session's log names their reports | 4 Nov | — |
| R5 | Plugins are first-party code in this repository; nothing from elsewhere loads through the plugin host. One that must, runs in its own process as a connector does | 4 Nov | test |
| R6 | One request of a person makes at most 8 asks or tasks given between agents and 4 hops in a chain, then waits for Continue; Alpha counts them, not the model, and the same ask is not made twice in one chain | 9 Nov | test |
| R7 | An agent's check only looks: it reads and cannot write, draft, send or use the model. A scheduled run cannot make or change a schedule | 10 Nov | test |
