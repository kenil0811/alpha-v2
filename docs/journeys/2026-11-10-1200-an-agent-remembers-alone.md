# Journey an-agent-remembers: 2026-11-10 12:00

An agent made in a sentence keeps what it is told, even after its instructions change

Fresh tenant, model claude-opus-5-5, on Claude Code, Alpha's prompt alone.
**Passed** in 11 s, $0.23.


## 1. Said “Make an agent called Scout. Its job is finding businesses for sale, and I would ask it when I need deals found. Its instructions: answer in one short paragraph.
”

Reply (5.0 s): Scout is set up. Its job is finding businesses for sale, you can ask it whenever you need deals found, and it will answer in one short paragraph.

Steps: Looked for the right connection; Looked at the team; Kept the agent Scout.

Spent so far: claude-haiku-5-5: in 1216 (cache read 0), out 18; claude-opus-5-5: in 90888 (cache read 84276), out 363; $0.08.

- pass: agents: 1 (saw 1)
- pass: errors: 0 (saw 0)

## 2. Said “Remember this for next time, it is true of every deal with them. Acme only signs annual contracts.”

Reply (2.5 s): Saved: Acme only signs annual contracts, on every deal with them, and I'll have that to hand next time Acme comes up.

Steps: Noted something to remember.

Spent so far: claude-haiku-5-5: in 2410 (cache read 0), out 36; claude-opus-5-5: in 136180 (cache read 122763), out 523; $0.14.

- pass: Scout remembers annual (saw Acme only signs annual contracts; this holds for every deal with them.)
- pass: errors: 0 (saw 0)

## 3. Said “Change Scout's instructions so it always answers in exactly two sentences.”

Reply (2.3 s): Done. Scout will now always answer in exactly two sentences, replacing the one short paragraph instruction.

Steps: Kept the agent Scout.

Spent so far: claude-haiku-5-5: in 2432 (cache read 0), out 36; claude-opus-5-5: in 228752 (cache read 215048), out 913; $0.17.

- pass: Scout's instructions say two sentences (saw Always answer in exactly two sentences.)
- pass: errors: 0 (saw 0)

## 4. Said “What kind of contract does Acme sign?”

Reply (1.4 s): Acme only signs annual contracts. You told me that holds for every deal with them.

Spent so far: claude-haiku-5-5: in 3609 (cache read 0), out 51; claude-opus-5-5: in 251338 (cache read 230958), out 975; $0.23.

- pass: the reply matches /annual/ (saw Acme only signs annual contracts. You told me that holds for every deal with them.)
- pass: errors: 0 (saw 0)

The journal verifies, rows included: 25 lines.

## The world after
