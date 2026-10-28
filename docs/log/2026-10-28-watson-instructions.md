# 28 October 2026: Watson leaves out what the person told Alpha to do

Kenil asked for Alpha's own tables' reshape (core plan step 4's last piece); there was none to do,
since Decisions and Noticed have lived under Intelligence › Second Brain since 26 Oct, as the core
plan's first cut said. Two things found reading them, on his "yes":

- **Watson noticed instructions as decisions and facts.** In his Alpha, 6 of the 7 it put to him
  were things he had told Alpha to do ("Add Acme Bakery, with revenue…", "From now on, never email
  anyone at…"). Watson now leaves out, before the model sees them, the lines whose turn wrote rows,
  changed a table, made a task or opened a card (a rule's Save among them): those were acted on.
  `alpha.journal.list` gives each line its turn (the kit API page regenerated). Alpha kit 0.3.2.
  Test in `modules/watson.test.ts`, failing before.
- **Second Brain's words** for Decisions and Noticed said "What Alpha decided, and the rules you
  approved" and "What Alpha noticed while it worked": they are the person's own decisions and the
  facts they stated, kept once they say so; rules are in Settings › Permissions.
