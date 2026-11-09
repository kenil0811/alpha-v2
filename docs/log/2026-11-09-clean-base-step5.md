# 9 November 2026: the clean base, step 5, modules and the kit API

Kenil's calls on the detail (doc https://claude.ai/artifact/XbicPnT2YmVvCZbA8Goaye): a module keeps
several pages, each a tab with the front one first; the rename goes all the way down; the @ in the
message box goes until step 7.

- What Alpha called an agent is a schedule, everywhere: the folder `schedules/`, the table
  `schedules`, a run's `schedule_id`, the journal's actor and a rule's scope, `/api/schedules`,
  `#/schedule/<id>`, the code, and the words in `docs/rules.md` and `docs/ui-rules.md`. Step 7 has the
  word agent free. `docs/design.md` keeps the old word until step 8 rewrites it.
- The kit API is 2 and Alpha serves only that. A kit that says `api: 1`, or no api, is refused, so
  DealPilot and Accounting in `alpha-avilo` stop installing until they are rebuilt.
- A module's tabs are People and Organizations where it says so, an Overview when modules sit inside
  it, its pages, its tables and Setup. The Conversation and Agents and notes tabs are gone. Setup
  (`ModuleSetup.tsx`) holds where it comes from, the business case, its schedules with Run now and on
  or paused, its setup tables and parts, notes, what is the person's, and Pack it.
- Intelligence is Modules, Schedules, Connections and How to work. Modules lists every module and
  opens its Setup; installing sits below the list, the owner's alone, the folder box only on a
  developer's Alpha. Settings has no Modules any more.
- Left from step 2 and gone now: the `keep` tool's words about a schedule that takes tasks, and a
  task's owner of kind agent on its route.

Journeys: all once on 9 Nov ($3.28; summary `docs/journeys/2026-11-09-1310-summary.md`), all passed but the one that waits on step 8.
