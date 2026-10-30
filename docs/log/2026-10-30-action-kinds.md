# 30 October 2026: what each action is, and Revert on it

Step 2 of the final plan, part 2, on Kenil's "yes" (11:41); problems-list item 14.

- Connector SDK: `Tool.undo`, `'final'` or `{kind: undoable | counter, said, words, run}`; a
  write or send that says nothing is final; the check refuses a half-said one. Gmail's draft is
  counter (its take-back discards the draft by the id the call returned, `c.call('discard')`),
  its send final.
- The connector's process describes each tool's undo; `undo_words` and `undo` are two more
  requests down its pipe. `CallSays.undo` carries the kind and the card's words; the gate's
  `after` (now async, given the call's result on both routes) keeps on the `called` line what the
  call is once done (`undo: {kind, did, words, result}`), and a counter's card says the tool's
  `said` instead of "Once it has gone…".
- Revert (`records/revert.ts`): a turn or run with a take-back is undoable; the preview says
  the take-backs with the rows and names final actions among what stays; the reverted line keeps
  the take-backs' lines; `connectors/takeback.ts` `revertAll` runs them after the rows, journaled
  as `took_back` (a failure in its own line, the rest go on). The Activity route and the journeys
  revert through it. The journeys' `revert: last_turn` counts a turn with a take-back.
- Tests: `records/revert.test.ts` (counter offered, final named), `activity.test.ts` (the draft's
  turn has Revert, the send's not); journey `mail-on-recorded-answers` gains a draft and its
  Revert (the draft discarded on recorded answers). All failing before. The process rules moved
  to `connectors/rules.ts` (service.ts at the wall).
