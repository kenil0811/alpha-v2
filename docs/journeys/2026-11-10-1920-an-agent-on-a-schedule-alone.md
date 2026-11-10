# Journey an-agent-on-a-schedule: 2026-11-10 19:20

An agent keeps a schedule made in a sentence, reports on it, and can answer for it later

Fresh tenant, model claude-opus-5-5, on Claude Code, Alpha's prompt alone.
**Passed** in 14 s, $0.22.


## 1. Said “Make an agent called Herald. Its job is short status lines. Its instructions: answer in one short sentence.
”

Reply (5.1 s): I made Herald. Its job is to write short status lines, and its instruction is to answer in one short sentence. It starts working from the next message you send it.

Steps: Looked for the right connection; Kept the agent Herald.

Spent so far: claude-haiku-5-5: in 1198 (cache read 0), out 15; claude-opus-5-5: in 64720 (cache read 59518), out 323; $0.06.

- pass: agents: 1 (saw 1)
- pass: errors: 0 (saw 0)

## 2. Said “Every weekday at 8 in the morning, send me the word bluebird and nothing else. Keep that as a schedule called Morning word.
”

Reply (5.2 s): I set up a schedule called Morning word that sends you just the word "bluebird" every weekday at 8:00, starting tomorrow morning.

Steps: Looked for the right connection; Worked on it.

Spent so far: claude-haiku-5-5: in 2405 (cache read 0), out 31; claude-opus-5-5: in 132005 (cache read 119729), out 634; $0.14.

- pass: Herald keeps 1 schedule(s) with no check (saw Morning word (no check))
- pass: errors: 0 (saw 0)

## 3. Pressed Run now on Morning word: Morning word woke its agent.

Took 2.2 s.

- pass: the task Morning word is done, 1 of them (saw 1, the newest done)
- pass: the reply matches /bluebird/ (saw bluebird)
- pass: errors: 0 (saw 0)

## 4. Said “What word did you send me from your schedule?”

Reply (1.9 s): The Morning word schedule sent you "bluebird" today at 19:20, which looks like a test run since the regular sends start tomorrow at 8:00.

Spent so far: claude-haiku-5-5: in 3718 (cache read 0), out 49; claude-opus-5-5: in 222563 (cache read 202918), out 1057; $0.22.

- pass: the reply matches /bluebird/ (saw The Morning word schedule sent you "bluebird" today at 19:20, which looks like a test run since the regular sends start tomorrow at 8:00.)
- pass: errors: 0 (saw 0)

The journal verifies, rows included: 26 lines.

## The world after
