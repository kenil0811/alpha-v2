# Journey an-agent-on-a-schedule: 2026-11-11 00:52

An agent keeps a schedule made in a sentence, reports on it, and can answer for it later

Fresh tenant, model claude-opus-5-5, on Claude Code, Alpha's prompt alone.
**Passed** in 13 s, $0.25.


## 1. Said “Make an agent called Herald. Its job is short status lines. Its instructions: answer in one short sentence.
”

Reply (4.6 s): I've made a new agent called Herald. Its job is short status lines, and its instructions are to answer in one short sentence. It will start working from the next message it gets.

Steps: Looked for the right connection; Kept the agent Herald.

Spent so far: claude-haiku-5-5: in 1198 (cache read 0), out 15; claude-opus-5-5: in 67932 (cache read 61373), out 319; $0.07.

- pass: agents: 1 (saw 1)
- pass: errors: 0 (saw 0)

## 2. Said “Every weekday at 8 in the morning, send me the word bluebird and nothing else. Keep that as a schedule called Morning word.
”

Reply (5.1 s): I've set up a schedule called Morning word that sends you "bluebird" and nothing else at 8am every weekday, starting at 8 this morning.

Steps: Looked for the right connection; Worked on it.

Spent so far: claude-haiku-5-5: in 2405 (cache read 0), out 31; claude-opus-5-5: in 138393 (cache read 123732), out 658; $0.16.

- pass: Herald keeps 1 schedule(s) with no check (saw Morning word (no check))
- pass: errors: 0 (saw 0)

## 3. Pressed Run now on Morning word: Morning word woke its agent.

Took 2.0 s.

- pass: the task Morning word is done, 1 of them (saw 1, the newest done)
- pass: the reply matches /bluebird/ (saw bluebird)
- pass: errors: 0 (saw 0)

## 4. Said “What word did you send me from your schedule?”

Reply (1.8 s): It sent "bluebird" just now at 00:52, apparently a first run when I set it up, and the regular 8am weekday sends start this morning.

Spent so far: claude-haiku-5-5: in 3712 (cache read 0), out 49; claude-opus-5-5: in 233170 (cache read 210100), out 1103; $0.25.

- pass: the reply matches /bluebird/ (saw It sent "bluebird" just now at 00:52, apparently a first run when I set it up, and the regular 8am weekday sends start this morning.)
- pass: errors: 0 (saw 0)

The journal verifies, rows included: 26 lines.

## The world after
