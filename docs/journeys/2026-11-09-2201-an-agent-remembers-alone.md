# Journey an-agent-remembers: 2026-11-09 22:01

An agent made in a sentence keeps what it is told, even after its instructions change

Fresh tenant, model claude-opus-5-5, on Claude Code, Alpha's prompt alone.
**Passed** in 13 s, $0.23.


## 1. Said “Make an agent called Scout. Its job is finding businesses for sale, and I would ask it when I need deals found. Its instructions: answer in one short paragraph.
”

Reply (4.2 s): Scout is set up to find businesses for sale, and you can ask it whenever you need deals found. It will answer in one short paragraph.

Steps: Looked for the right connection; Kept the agent Scout.

Spent so far: claude-haiku-5-5: in 1216 (cache read 0), out 18; claude-opus-5-5: in 67491 (cache read 60931), out 327; $0.07.

- pass: agents: 1 (saw 1)
- pass: errors: 0 (saw 0)

## 2. Said “Remember this for next time, it is true of every deal with them. Acme only signs annual contracts.”

Reply (2.8 s): Noted: Acme only signs annual contracts, on every deal with them, and I'll have that to hand next time Acme comes up.

Steps: Noted something to remember.

Spent so far: claude-haiku-5-5: in 2410 (cache read 0), out 36; claude-opus-5-5: in 112479 (cache read 99129), out 487; $0.14.

- pass: Scout remembers annual (saw Acme only signs annual contracts; this holds for every deal with them.)
- pass: errors: 0 (saw 0)

## 3. Said “Change Scout's instructions so it always answers in exactly two sentences.”

Reply (2.0 s): Scout will now always answer in exactly two sentences.

Steps: Kept the agent Scout.

Spent so far: claude-haiku-5-5: in 2432 (cache read 0), out 36; claude-opus-5-5: in 181568 (cache read 167976), out 824; $0.16.

- pass: Scout's instructions say two sentences (saw Always answer in exactly two sentences.)
- pass: errors: 0 (saw 0)

## 4. Said “What kind of contract does Acme sign?”

Reply (4.0 s): Acme only signs annual contracts.
That holds for every deal with them, as you told me and as I have it saved.

Steps: Looked in its memory.

Spent so far: claude-haiku-5-5: in 3609 (cache read 0), out 51; claude-opus-5-5: in 226697 (cache read 206184), out 1076; $0.23.

- pass: the reply matches /annual/ (saw Acme only signs annual contracts.
That holds for every deal with them, as you told me and as I have it saved.)
- pass: errors: 0 (saw 0)

## The world after
