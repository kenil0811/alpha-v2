# Journey an-agent-remembers: 2026-11-10 19:20

An agent made in a sentence keeps what it is told, even after its instructions change

Fresh tenant, model claude-opus-5-5, on Claude Code, Alpha's prompt alone.
**Passed** in 17 s, $0.19.


## 1. Said “Make an agent called Scout. Its job is finding businesses for sale, and I would ask it when I need deals found. Its instructions: answer in one short paragraph.
”

Reply (6.3 s): I've made Scout. Its job is finding businesses for sale, and you can ask it whenever you need deals found. Its instructions are to answer in one short paragraph.

Steps: Looked for the right connection; Kept the agent Scout.

Spent so far: claude-haiku-5-5: in 1216 (cache read 0), out 18; claude-opus-5-5: in 64721 (cache read 59520), out 355; $0.06.

- pass: agents: 1 (saw 1)
- pass: errors: 0 (saw 0)

## 2. Said “Remember this for next time, it is true of every deal with them. Acme only signs annual contracts.”

Reply (5.3 s): I've saved it: Acme only signs annual contracts, and that applies to every deal with them. I'll remember it in future conversations. It's saved for you only. If the rest of the firm should have it too, tell me and I'll share it.

Steps: Noted something to remember.

Spent so far: claude-haiku-5-5: in 2410 (cache read 0), out 36; claude-opus-5-5: in 107966 (cache read 96910), out 669; $0.12.

- pass: Scout remembers annual (saw Acme only signs annual contracts; this holds for every deal with them.)
- pass: errors: 0 (saw 0)

## 3. Said “Change Scout's instructions so it always answers in exactly two sentences.”

Reply (2.9 s): I've changed Scout's instructions so it always answers in exactly two sentences, in place of the short paragraph. Its next reply will follow the new rule.

Steps: Kept the agent Scout.

Spent so far: claude-haiku-5-5: in 2432 (cache read 0), out 36; claude-opus-5-5: in 174382 (cache read 163423), out 931; $0.14.

- pass: Scout's instructions say two sentences (saw Find businesses for sale that fit the request. Always answer in exactly two sentences.)
- pass: errors: 0 (saw 0)

## 4. Said “What kind of contract does Acme sign?”

Reply (2.6 s): Acme only signs annual contracts, and that holds for every deal with them. You told me this earlier and I saved it, so I'll keep it in mind for any Acme deal.

Spent so far: claude-haiku-5-5: in 3609 (cache read 0), out 51; claude-opus-5-5: in 195906 (cache read 179333), out 1021; $0.19.

- pass: the reply matches /annual/ (saw Acme only signs annual contracts, and that holds for every deal with them. You told me this earlier and I saved it, so I'll keep it in mind for any Acme deal.)
- pass: errors: 0 (saw 0)

The journal verifies, rows included: 23 lines.

## The world after
