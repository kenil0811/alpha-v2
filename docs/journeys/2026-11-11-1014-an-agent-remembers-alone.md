# Journey an-agent-remembers: 2026-11-11 10:14

An agent made in a sentence keeps what it is told, even after its instructions change

Fresh tenant, model claude-opus-5-5, on Claude Code, Alpha's prompt alone.
**Passed** in 17 s, $0.23.


## 1. Said “Make an agent called Scout. Its job is finding businesses for sale, and I would ask it when I need deals found. Its instructions: answer in one short paragraph.
”

Reply (5.8 s): I've set up Scout. Its job is finding businesses for sale, and it answers in one short paragraph. When you need deals found, just ask Scout. It's ready for your first request.

Steps: Looked for the right connection; Kept the agent Scout.

Spent so far: claude-haiku-5-5: in 1216 (cache read 0), out 18; claude-opus-5-5: in 67933 (cache read 61356), out 357; $0.07.

- pass: agents: 1 (saw 1)
- pass: errors: 0 (saw 0)

## 2. Said “Remember this for next time, it is true of every deal with them. Acme only signs annual contracts.”

Reply (4.5 s): I've saved it. From now on I'll remember that Acme only signs annual contracts, for every deal with them.

Steps: Noted something to remember.

Spent so far: claude-haiku-5-5: in 2410 (cache read 0), out 36; claude-opus-5-5: in 113192 (cache read 99790), out 593; $0.14.

- pass: Scout remembers annual (saw Acme only signs annual contracts; this holds for every deal with Acme.)
- pass: errors: 0 (saw 0)

## 3. Said “Change Scout's instructions so it always answers in exactly two sentences.”

Reply (3.0 s): I've updated Scout. It now always answers in exactly two sentences, starting with your next request.

Steps: Kept the agent Scout.

Spent so far: claude-haiku-5-5: in 2432 (cache read 0), out 36; claude-opus-5-5: in 182837 (cache read 169168), out 915; $0.16.

- pass: Scout's instructions say two sentences (saw Find businesses for sale that match the request. Always answer in exactly two sentences.)
- pass: errors: 0 (saw 0)

## 4. Said “What kind of contract does Acme sign?”

Reply (3.4 s): Acme only signs annual contracts. That holds for every deal with them, and it's what I have saved from what you told me earlier.

Steps: Looked in its memory.

Spent so far: claude-haiku-5-5: in 3609 (cache read 0), out 51; claude-opus-5-5: in 228116 (cache read 207642), out 1073; $0.23.

- pass: the reply matches /annual/ (saw Acme only signs annual contracts. That holds for every deal with them, and it's what I have saved from what you told me earlier.)
- pass: errors: 0 (saw 0)

The journal verifies, rows included: 25 lines.

## The world after
