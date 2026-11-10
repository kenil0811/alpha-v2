# Journey an-agent-on-a-schedule: 2026-11-10 20:49

An agent keeps a schedule made in a sentence, reports on it, and can answer for it later

Fresh tenant, model claude-opus-5-5, on Claude Code, Alpha's prompt alone.
**Passed** in 13 s, $0.25.


## 1. Said “Make an agent called Herald. Its job is short status lines. Its instructions: answer in one short sentence.
”

Reply (5.2 s): I've made a new agent called Herald. Its job is short status lines, and its instructions say to answer in one short sentence. It will start working from the next message it gets.

Steps: Looked for the right connection; Kept the agent Herald.

Spent so far: claude-haiku-5-5: in 1198 (cache read 0), out 15; claude-opus-5-5: in 68012 (cache read 61416), out 338; $0.07.

- pass: agents: 1 (saw 1)
- pass: errors: 0 (saw 0)

## 2. Said “Every weekday at 8 in the morning, send me the word bluebird and nothing else. Keep that as a schedule called Morning word.
”

Reply (5.3 s): I've set up Morning word: every weekday at 8:00 it will send you just "bluebird", starting tomorrow, Wednesday 11 November.

Steps: Looked for the right connection; Worked on it.

Spent so far: claude-haiku-5-5: in 2405 (cache read 0), out 31; claude-opus-5-5: in 138577 (cache read 123830), out 696; $0.16.

- pass: Herald keeps 1 schedule(s) with no check (saw Morning word (no check))
- pass: errors: 0 (saw 0)

## 3. Pressed Run now on Morning word: Morning word woke its agent.

Took 1.4 s.

- pass: the task Morning word is done, 1 of them (saw 1, the newest done)
- pass: the reply matches /bluebird/ (saw bluebird)
- pass: errors: 0 (saw 0)

## 4. Said “What word did you send me from your schedule?”

Reply (1.5 s): Morning word sent you "bluebird", in a run tonight at 20:49 when the schedule was set up.

Spent so far: claude-haiku-5-5: in 3726 (cache read 0), out 49; claude-opus-5-5: in 233516 (cache read 210297), out 1134; $0.25.

- pass: the reply matches /bluebird/ (saw Morning word sent you "bluebird", in a run tonight at 20:49 when the schedule was set up.)
- pass: errors: 0 (saw 0)

The journal verifies, rows included: 26 lines.

## The world after
