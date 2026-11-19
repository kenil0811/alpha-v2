# 19 Nov 2026: Onboarding, step 4 (the interviews plugin and its kit)

Step 4 of the onboarding plan (calls 1, 2, 27 and 29), built straight from the list.

- `plugins/interviews`, a workspace package: the plugin (`interviews`, titled Interviews), whose
  register adds nothing yet; its tools, routes and screens come with the steps that need them.
- Its kit, Your work (api 3, managed as a plugin's kit is): Workflows (name, person, what the data
  shows, what it means, times a month, minutes each, hours a month, rank, status, rests on), their
  Steps and Proposals as parts of them, and About you (line, person, for, state, rests on). The
  numbers' estimated marks are their provenance, so the fields carry none of their own.
- The Interviewer in the kit's agents/, with a short first brief; step 5 writes its AGENT.md from
  onboarding.md and answer.ts on the reference branch.
- `alpha plugins [<plugin> …]` on a server writes alpha.yaml's plugins line and restarts that
  Alpha, and `pnpm server plugins <address> [<plugin> …]` says it from the Mac. Interviews is on for
  Kenil's Mac Alpha and his server Alpha.
- A test that the plugin loads from plugins/ where alpha.yaml names it and its kit makes Your
  work with the Interviewer.
