# Journey an-agent-remembers: 2026-11-10 20:49

An agent made in a sentence keeps what it is told, even after its instructions change

Fresh tenant, model claude-opus-5-5, on Claude Code, Alpha's prompt alone.
**Passed** in 15 s, $0.23.


## 1. Said “Make an agent called Scout. Its job is finding businesses for sale, and I would ask it when I need deals found. Its instructions: answer in one short paragraph.
”

Reply (5.0 s): I've made Scout. Its job is finding businesses for sale, and it will answer in one short paragraph. It doesn't know yet what kind of deals you want, so tell it the sector, size or location when you ask it to find some.

Steps: Looked for the right connection; Kept the agent Scout.

Spent so far: claude-haiku-5-5: in 1216 (cache read 0), out 18; claude-opus-5-5: in 67917 (cache read 61349), out 358; $0.07.

- pass: agents: 1 (saw 1)
- pass: errors: 0 (saw 0)

## 2. Said “Remember this for next time, it is true of every deal with them. Acme only signs annual contracts.”

Reply (3.8 s): I've saved it to memory: Acme only signs annual contracts, and that holds for every deal with them. It will be there in future conversations when Acme comes up.

Steps: Noted something to remember.

Spent so far: claude-haiku-5-5: in 2410 (cache read 0), out 36; claude-opus-5-5: in 113277 (cache read 99832), out 602; $0.14.

- pass: Scout remembers annual (saw Acme only signs annual contracts; this holds for every deal with Acme.)
- pass: errors: 0 (saw 0)

## 3. Said “Change Scout's instructions so it always answers in exactly two sentences.”

Reply (2.7 s): I've changed Scout's instructions. It will now always answer in exactly two sentences, which replaces the one-paragraph rule. The change applies from its next message.

Steps: Kept the agent Scout.

Spent so far: claude-haiku-5-5: in 2432 (cache read 0), out 36; claude-opus-5-5: in 182796 (cache read 169142), out 925; $0.16.

- pass: Scout's instructions say two sentences (saw Always answer in exactly two sentences.)
- pass: errors: 0 (saw 0)

## 4. Said “What kind of contract does Acme sign?”

Reply (3.0 s): Acme signs only annual contracts, and that's true of every deal with them. That's what you told me to remember, and it's still in my memory.

Steps: Looked in its memory.

Spent so far: claude-haiku-5-5: in 3609 (cache read 0), out 51; claude-opus-5-5: in 228111 (cache read 207641), out 1060; $0.23.

- pass: the reply matches /annual/ (saw Acme signs only annual contracts, and that's true of every deal with them. That's what you told me to remember, and it's still in my memory.)
- pass: errors: 0 (saw 0)

The journal verifies, rows included: 25 lines.

## The world after
