# 28 October 2026: an agent's email goes once, and the documentation report's code items

From the documentation drift report, Kenil's "yes".

- **No double send under Always.** An agent's draft under a standing permission goes at once; its
  agent writes it down after. A run that stopped between the two (a crash, the Mac asleep, a write
  refused) was retried in full, and the retry drafted and sent the same thing again with a fresh
  Message-ID, which call A's guard does not catch. Now the same thing (agent, kind and key) to the
  same address goes once on its own: drafted again after it went, it waits on a card saying when
  it went. A draft with no key, or to another address, is as before. Test in
  `modules/drafts.test.ts`, failing before; no journey, since a journey cannot stop a run between
  two calls on purpose.
- **Wording:** the kit API says Settings › Modules (not Kits), regenerated; Network 0.4.1's notes
  say Intelligence › Connections; a connector's oauth comment says the sign-in app is the client's.
- **CI** checks Alpha's own kit too (`pnpm kit check core/kits/alpha`).
- **A journey with no card to answer fails on its own**, where the runner stopped every journey after it.
