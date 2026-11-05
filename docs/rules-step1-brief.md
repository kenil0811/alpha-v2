# Step 1 of the production rules: the build brief (work in progress)

Kenil said yes to all five questions of the step 1 detail (5 Nov 09:53): rules.md as written,
strict waits, a door-list wall, R4 held by review for now, journey 4 written now and waiting on
step 8. Detail doc: https://claude.ai/artifact/5f5Bgao6RTaskyDHc3Yo7N. This branch holds what was
started in the cloud on 5 Nov; Kenil wants it built on his Mac, so carry on from here there. This
file goes before the push to main.

## Done on this branch

- `docs/rules.md`: the rules, each with its Held by mark (test, skip (step N), step 8, —).
- `core/src/rules/doors.ts`: every door that can change a row or a module, with what it `can`
  do and where it is (routes, tools, plugin calls); `NOT_DOORS` names the rest, each with why.
- `core/src/rules/kits/`: three made-up kits (Case desk managed, its next version, Supply
  maintained by Mira).
- `core/src/rules/world.ts`: the rule world, a fresh tenant per case (Bakery with supplier
  `harbor`, the made-up Mailbox with message `m1`, optional kits and the plugin).
- `core/src/rules/drive.ts`: a driver for each door's acts, driven as the core drives it.
- `core/src/rules/rule.ts`: `rule()`, which tries a rule through every door that can do its
  acts, plus named cases. Strict waits: a case that waits passes only while the rule fails, and
  fails the day it holds ("take its waits mark off"). `later` cases are todos. Each rule checks
  that its mark in docs/rules.md matches its waits.
- `core/src/rules/check.ts`: `checkRules()`, `writeRoutes()` and `pluginCalls()`, with no
  vitest, so the `pnpm rules` script can use them.
- Tests, all passing:
  - `modules.test.ts` (M1 to M5);
  - `data.test.ts` (D1 to D5);
  - `mirrors.test.ts` (D6 to D12).
- `audit.test.ts` (A1, A3, A4) is written. One case still fails: "a refused change leaves no
  line". The window's refused add writes a line. See which kind, then either mark it
  `waits: 2` or count only change lines.

## What the tests found

- **D2.** Alpha's change tool overwrites and clears the person's value. Its cases wait on step 2.
  Agents and connectors already keep the person's value, and a revert of a machine's run leaves
  it.
- **D3, D4, D5.** These wait on step 4:
  - no newer value is kept beside the person's;
  - Reset has nothing to put back;
  - a land brings a removed row back;
  - a number the person never said stays stated.
- **D6.** A correction already stands through a read. Keeping the source's value beside it, and
  Reset, wait on step 4.
- **D8.** A mirror's row can be removed or reverted today. That waits on step 5.
- **M1 to M5.** Each waits where the detail doc said. M4's shape tool already makes the card.
- **A question for Kenil (M1 against D7).** M1 says a connector's module is managed by Alpha,
  but D7 lets own fields sit beside the source's. The M1 test only checks that source fields
  can't be renamed. Proposed wording: "a connector's module is managed for its source fields".

## Still to do

1. **Finish the A1 case above.**
2. **`reliability.test.ts`.**
   - R1, waiting on step 7:
     - a Scheduler job that throws 'the disk is full' leaves a line saying so;
     - two failures in a row leave a waiting card.
   - R2: later only (two cases, step 7).
   - R3, all holding. Each case lists what is missing:
     - `checkRules()` has no problems;
     - every `writeRoutes()` entry is in a door's `where` or in NOT_DOORS;
     - every name in `TOOL_NAMES` appears as `tool x` in a door or in NOT_DOORS;
     - every `pluginCalls()` entry is covered;
     - every act in a door's `can` has a driver.

     The door-list wall lives here, not in a doors.test.ts.
   - R5, holding: every non-test `loadPlugins(` outside core/src/rules passes `PLUGINS_DIR`
     (today that is only main.ts).
3. **M2's later case.** Add: "in a managed mirror the kit decides whether its source fields take
   corrections (D6)", step 6.
4. **The wall.**
   - `scripts/rules-check.ts` prints `checkRules()`'s problems and summary, and exits 1 on any
     problem.
   - In package.json, add `"rules": "node scripts/rules-check.ts"` and add `&& pnpm rules` to
     `check`.
5. **The journey runner** (`core/src/journeys/run.ts`, `checks.ts`).
   - Checks:
     - each check gets an optional `waits: N`;
     - the report shows "waits (step N)";
     - a waiting check that passes says "holds now: take off waits" and counts as a failure;
     - a journey whose checks all wait is not run.
   - New steps `edit`, `remove` and `reset`, through the window routes.
   - `site` gains a `state`.
   - A `beside` check, which reads `provenance.beside`.
6. **Four journeys.**
   - `an-open-module-is-the-firms`: the field rename is a `say` step, because the window
     cannot rename fields. The firms site is journeys/fixtures/sites/firms.
   - `a-managed-module-holds`: waits on step 6; its kit fixture goes under journeys/fixtures.
   - `a-mirror-follows-its-source`: waits on steps 4 and 5. The firms site's later state has
     Oat Mill's page say sales@mill.example.
   - `a-mirror-change-is-a-request`: every check waits on step 8.
7. **Docs.**
   - design.md: a new §20 "The rules for modules and data"; Working rules becomes §21.
   - CLAUDE.md, a Rules line: "Read `docs/rules.md` before any change to the core's world, its
     routes or tools, an agent's scripts, a connector's tables or a plugin; a rule goes there the
     day Kenil says yes to it, with the test that holds it."
   - docs/ui-contributions.md: a Lane 2 pointer.
   - A docs/log entry.
8. **Checks.** Run `pnpm check` (tsc, biome, the full suite, long-files and the platform check),
   `pnpm rules`, and `pnpm journey an-open-module-is-the-firms`.
9. **Show Kenil.** Tell him exactly what to read and run. Push to main only on his "looks good",
   with this brief deleted.
