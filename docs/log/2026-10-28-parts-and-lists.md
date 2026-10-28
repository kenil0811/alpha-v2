# 28 October 2026: a row's long parts, and a list back to one (core plan step 4, a client's kit)

Two small core changes came with a client's kit reshaped into the places of step 3 (its plan
accepted by Kenil the same day), whose clients will each carry hundreds of ledger lines as parts.

- **A row's parts show their twelve changed most lately**, with how many in all: the row's view
  reads only those (`parts_shown: 12` in limits.yaml, the number a row's links show), says "and N
  more", and Open as a table opens the part's table on the rows naming this one (`?of=<row>`), in
  place of a list of ids.
- **A list no one made comes back to one.** The move to real tables (22 Oct) left some relations a
  kit says hold one holding a list. A kit update now turns such a relation back to one when no row
  holds two (`setOne` in `world/shape/fields.ts`, journaled as `shaped`), so it can become part of
  a row; a list a row holds two in stays, said why, and a list someone made (a kit's version, the
  person, Alpha: a `shaped` line says so) stays theirs.
- **A kit the core refuses fails its journey** with the core's words, where the runner stopped.

Tests `world/one-again.test.ts` and `api/rows.test.ts`; `pnpm check` passes.
