# 29 October 2026: Activity shows what Alpha did through a connector

Kenil, after his draft-and-send test: "why is there nothing in activity about draft getting
created or sent!" Activity listed runs, reads and turns that changed rows; a Gmail draft or send
changes no row, so its turn was never an entry, though every line of it was in the journal. On
his "yes" (ahead of step 2's part 2, which marks each outward action undoable, a counter-action or
final):

- The gate's call line for a connector's tool keeps its effect (read, write, outward), and the
  `called` line of a call that went on the person's yes names that card.
- Activity (now `api/activity-view.ts`, out of `views.ts`) makes a turn entry for each turn with a
  write or a send that went: the person's words, then a step per action ("Saved a draft to …",
  "Send your draft to …, on your yes"), a send on a card's yes under the turn that asked for it.
  No Revert on those until part 2. Lines from before today keep no effect, so they stay unshown.
- Test: `api/activity.test.ts`, failing before.
