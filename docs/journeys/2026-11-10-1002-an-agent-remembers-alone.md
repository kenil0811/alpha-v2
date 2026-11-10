# Journey an-agent-remembers: 2026-11-10 10:02

An agent made in a sentence keeps what it is told, even after its instructions change

Fresh tenant, model claude-opus-5-5, on Claude Code, Alpha's prompt alone.
**Passed** in 13 s, $0.23.


## 1. Said “Make an agent called Scout. Its job is finding businesses for sale, and I would ask it when I need deals found. Its instructions: answer in one short paragraph.
”

Reply (4.2 s): Scout is set up to find businesses for sale whenever you ask it for deals, and it will answer in one short paragraph.

Steps: Looked for the right connection; Kept the agent Scout.

Spent so far: claude-opus-5-5: in 67945 (cache read 61371), out 322; claude-haiku-5-5: in 1216 (cache read 0), out 200; $0.07.

- pass: agents: 1 (saw 1)
- pass: errors: 0 (saw 0)

## 2. Said “Remember this for next time, it is true of every deal with them. Acme only signs annual contracts.”

Reply (2.9 s): Noted: Acme only signs annual contracts, on every deal with them, and I'll remember that next time.

Steps: Noted something to remember.

Spent so far: claude-opus-5-5: in 113198 (cache read 99840), out 500; claude-haiku-5-5: in 2410 (cache read 0), out 218; $0.14.

- pass: Scout remembers annual (saw Acme only signs annual contracts, on every deal with them.)
- pass: errors: 0 (saw 0)

## 3. Said “Change Scout's instructions so it always answers in exactly two sentences.”

Reply (2.0 s): Scout will now always answer in exactly two sentences.

Steps: Kept the agent Scout.

Spent so far: claude-opus-5-5: in 182774 (cache read 169156), out 814; claude-haiku-5-5: in 2432 (cache read 0), out 400; $0.16.

- pass: Scout's instructions say two sentences (saw Always answer in exactly two sentences.)
- pass: errors: 0 (saw 0)

## 4. Said “What kind of contract does Acme sign?”

Reply (4.1 s): Acme only signs annual contracts, on every deal with them. That comes from what you told me earlier, and it's saved in my memory for future conversations.

Steps: Looked in its memory.

Spent so far: claude-opus-5-5: in 228184 (cache read 207622), out 1120; claude-haiku-5-5: in 3609 (cache read 0), out 415; $0.23.

- pass: the reply matches /annual/ (saw Acme only signs annual contracts, on every deal with them. That comes from what you told me earlier, and it's saved in my memory for future conversations.)
- pass: errors: 0 (saw 0)

## The world after
