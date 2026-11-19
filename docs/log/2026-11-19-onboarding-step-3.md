# 19 Nov 2026: Onboarding, step 3 (the plugin seam)

Step 3 of the onboarding plan (calls 2, 47 to 49), built straight from the list.

- alpha.yaml's `plugins:` line names the plugins an Alpha loads; one not named does not load at
  all (`switchOn` in `core/src/plugins/plugins.ts`, used by the core and the journeys alike). The
  window shows a plugin's row on Home and its page only for the plugins `/api/me` says are on.
- Three new host calls: `tools(agent, tools)`, tools for an agent the plugin's kit carries, in
  that agent's desks alone (through `Hands.plugins`); `converse(person, agent, words, brief)`, a
  turn in that agent's chat for the person (the desk's `takeWork`); `howToWork(turn, lines)`, a
  review card of the plugin's own rows in its agent's chat, where a row the person keeps is
  written to their How to work under the heading and journaled `remembered` in their name.
- Switched off after use, a plugin's kit module and rows stay; its agents and schedules are hidden
  and do not run (`kits.plugin`, migration 5; `Agents.list`, `shownSchedules`), and come back as
  they were when it is on again.
- How to work's file is written in one place now (`core/src/world/how-to-work.ts`), for the
  remember tool and for a kept line alike; a line already there is not kept twice.
- Rules P1 and P2 with their tests (`core/src/rules/plugins.test.ts`), on the made-up plugin, which
  gained an agent, a schedule and a tool; the three calls are named in NOT_DOORS.

What the code showed the list missed: a plugin's routes did not know who was asking, only the
owner the core started with, so on an Alpha where people sign in every person would have been the
owner. Each route is now handed the person asking (`Input.person`), and the calls that act for
someone take that person.
