# 19 Nov 2026: Onboarding, step 6 (the Interviewer's tools and their walls)

Step 6 of the onboarding plan (calls 8, 11 to 18, 22 to 33), built straight from the list.

- The source tool: one source put to the person on its own card (its name first, then Allow or
  Skip, what it reads in the detail), one waiting at a time; once allowed it is read and what was
  found is said, the counts and the top few with what may be cited; a skipped one is never read.
  Mail, Calendar and Contacts read what Alpha's own tables hold; A folder the names, kinds and
  dates of what the folder connector kept; What you have in Alpha the modules, agents, schedules
  and the person's own Activity. Browsing, Apps and AI work read Your work's Sites, Apps and AI
  requests, which the Bridge readers fill in step 9; until then they say nothing has come.
- The propose tool, the one way anything is put to the person: About you lines on one card to keep
  or drop (who the work is for on its own card, for everyone here, the owner's alone); workflows,
  their steps and proposals in Your work, a proposal played back on its own card with Yes, that's
  it; Yes, and also; Not this. The person's answers are copied onto the rows as they come.
- The walls (`walls.ts`, rewritten from answer.ts): a line must cite, and only what was read or
  answered; nothing skipped; no site or file name nothing read held; "you said" only of the words
  of the answers it cites; nothing dropped or declined again. How often is counted from the rows
  cited over the days read, how long is taken from the person's answer, hours a month is worked
  out, and an estimate is kept as one with its basis (`config.yaml`: 90 days back).
- Rules I1 to I4 with their tests (`core/src/rules/interviews.test.ts`), through the tools as the
  desk is given them.

What the code showed the list missed:
- The three host calls were not enough for walls in code. A source's Allow or Skip, and the
  minutes in an answer, are on cards the plugin must open and read; the folder's names are files,
  not rows; and what the person did in Alpha is the journal. So the host also gives `question`
  (a card in its own agent's chat), `answer` (what the person said on one), `files` and
  `activity` (reads), and `own.change` with a mark per value (worked out in code, or estimated)
  for its own rows.
- Table names are one list across an Alpha: the sources table is Interview sources, since a
  client's kit may hold a Sources (Deal pilot does).
- A card of lines an agent put to the person told no one when it was decided, so the agent would
  have stopped there; it now carries on, as on a question card.
