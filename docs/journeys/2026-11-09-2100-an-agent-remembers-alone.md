# Journey an-agent-remembers: 2026-11-09 21:00

An agent made in a sentence keeps what it is told, even after its instructions change

Fresh tenant, model claude-opus-5-5, on Claude Code, Alpha's prompt alone.
**Passed** in 12 s, $0.23.


## 1. Said “Make an agent called Scout. Its job is finding businesses for sale, and I would ask it when I need deals found. Its instructions: answer in one short paragraph.
”

Reply (4.4 s): Scout is set up. Its job is finding businesses for sale, you can ask it whenever you need deals found, and it will answer in one short paragraph.

Steps: Looked for the right connection; Kept the agent Scout.

Spent so far: claude-haiku-5-5: in 1216 (cache read 0), out 18; claude-opus-5-5: in 67382 (cache read 60836), out 329; $0.07.

- pass: agents: 1 (saw 1)
- pass: errors: 0 (saw 0)

## 2. Said “Remember this for next time, it is true of every deal with them. Acme only signs annual contracts.”

Reply (2.6 s): Noted: Acme only signs annual contracts, on every deal with them, and I'll remember that next time.

Steps: Noted something to remember.

Spent so far: claude-haiku-5-5: in 2410 (cache read 0), out 36; claude-opus-5-5: in 112288 (cache read 98969), out 481; $0.14.

- pass: Scout remembers annual (saw Acme only signs annual contracts; this holds for every deal with them.)
- pass: errors: 0 (saw 0)

## 3. Said “Change Scout's instructions so it always answers in exactly two sentences.”

Reply (2.1 s): Scout's instructions now say to always answer in exactly two sentences, replacing the one short paragraph.

Steps: Kept the agent Scout.

Spent so far: claude-haiku-5-5: in 2432 (cache read 0), out 36; claude-opus-5-5: in 181280 (cache read 167714), out 842; $0.16.

- pass: Scout's instructions say two sentences (saw Always answer in exactly two sentences.)
- pass: errors: 0 (saw 0)

## 4. Said “What kind of contract does Acme sign?”

Reply (3.3 s): Acme only signs annual contracts. That holds for every deal with them, as you told me and as I have it saved in memory.

Steps: Looked in its memory.

Spent so far: claude-haiku-5-5: in 3609 (cache read 0), out 51; claude-opus-5-5: in 226256 (cache read 205845), out 1049; $0.23.

- pass: the reply matches /annual/ (saw Acme only signs annual contracts. That holds for every deal with them, as you told me and as I have it saved in memory.)
- pass: errors: 0 (saw 0)

## The world after
