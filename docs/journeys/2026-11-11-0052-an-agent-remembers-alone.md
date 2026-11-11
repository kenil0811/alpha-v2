# Journey an-agent-remembers: 2026-11-11 00:52

An agent made in a sentence keeps what it is told, even after its instructions change

Fresh tenant, model claude-opus-5-5, on Claude Code, Alpha's prompt alone.
**Passed** in 14 s, $0.23.


## 1. Said “Make an agent called Scout. Its job is finding businesses for sale, and I would ask it when I need deals found. Its instructions: answer in one short paragraph.
”

Reply (4.9 s): I've made Scout. Its job is finding businesses for sale, so ask it whenever you need deals found. It will answer in one short paragraph.

Steps: Looked for the right connection; Kept the agent Scout.

Spent so far: claude-haiku-5-5: in 1216 (cache read 0), out 18; claude-opus-5-5: in 67985 (cache read 61393), out 349; $0.07.

- pass: agents: 1 (saw 1)
- pass: errors: 0 (saw 0)

## 2. Said “Remember this for next time, it is true of every deal with them. Acme only signs annual contracts.”

Reply (4.2 s): I've saved that Acme only signs annual contracts. It will come up whenever a deal with Acme does, in any later conversation.

Steps: Noted something to remember.

Spent so far: claude-haiku-5-5: in 2410 (cache read 0), out 36; claude-opus-5-5: in 113349 (cache read 99859), out 632; $0.14.

- pass: Scout remembers annual (saw Acme only signs annual contracts; this holds for every deal with Acme.)
- pass: errors: 0 (saw 0)

## 3. Said “Change Scout's instructions so it always answers in exactly two sentences.”

Reply (2.5 s): I've changed Scout's instructions. It now always answers in exactly two sentences, starting with its next message.

Steps: Kept the agent Scout.

Spent so far: claude-haiku-5-5: in 2432 (cache read 0), out 36; claude-opus-5-5: in 182936 (cache read 169261), out 890; $0.16.

- pass: Scout's instructions say two sentences (saw Always answer in exactly two sentences.)
- pass: errors: 0 (saw 0)

## 4. Said “What kind of contract does Acme sign?”

Reply (2.9 s): Acme only signs annual contracts. You told me this applies to every deal with them, and it's saved in my memory.

Steps: Looked in its memory.

Spent so far: claude-haiku-5-5: in 3609 (cache read 0), out 51; claude-opus-5-5: in 228233 (cache read 207749), out 1033; $0.23.

- pass: the reply matches /annual/ (saw Acme only signs annual contracts. You told me this applies to every deal with them, and it's saved in my memory.)
- pass: errors: 0 (saw 0)

The journal verifies, rows included: 25 lines.

## The world after
