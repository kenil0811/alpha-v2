# Journey an-agent-remembers: 2026-11-09 18:22

An agent made in a sentence keeps what it is told, even after its instructions change

Fresh tenant, model claude-opus-5-5, on Claude Code, Alpha's prompt alone.
**Passed** in 12 s, $0.21.


## 1. Said “Make an agent called Scout. Its job is finding businesses for sale, and I would ask it when I need deals found. Its instructions: answer in one short paragraph.
”

Reply (4.7 s): Scout is set up. Its job is finding businesses for sale, you can ask it whenever you need deals found, and it answers in one short paragraph.

Steps: Looked for the right connection; Looked at the team; Kept the agent Scout.

Spent so far: claude-haiku-5-5: in 1216 (cache read 0), out 18; claude-opus-5-5: in 67221 (cache read 61080), out 364; $0.07.

- pass: agents: 1 (saw 1)
- pass: errors: 0 (saw 0)

## 2. Said “Remember this for next time, it is true of every deal with them. Acme only signs annual contracts.”

Reply (2.9 s): Saved for next time: Acme only signs annual contracts, on every deal with them.

Steps: Noted something to remember.

Spent so far: claude-haiku-5-5: in 2410 (cache read 0), out 36; claude-opus-5-5: in 111962 (cache read 99096), out 506; $0.13.

- pass: Scout remembers annual (saw Acme only signs annual contracts, on every deal with them.)
- pass: errors: 0 (saw 0)

## 3. Said “Change Scout's instructions so it always answers in exactly two sentences.”

Reply (2.1 s): Done: Scout now always answers in exactly two sentences, starting with its next message.

Steps: Kept the agent Scout.

Spent so far: claude-haiku-5-5: in 2432 (cache read 0), out 36; claude-opus-5-5: in 180988 (cache read 168237), out 903; $0.15.

- pass: Scout's instructions say two sentences (saw Always answer in exactly two sentences.)
- pass: errors: 0 (saw 0)

## 4. Said “What kind of contract does Acme sign?”

Reply (1.9 s): Acme only signs annual contracts. You told me this holds for every deal with them.

Spent so far: claude-haiku-5-5: in 3609 (cache read 0), out 51; claude-opus-5-5: in 203283 (cache read 183950), out 974; $0.21.

- pass: the reply matches /annual/ (saw Acme only signs annual contracts. You told me this holds for every deal with them.)
- pass: errors: 0 (saw 0)

## The world after
