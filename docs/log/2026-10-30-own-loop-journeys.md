# 30 October 2026: journeys on the own loop (step 3, part 1)

Step 3 of the final plan, Build, planned at https://claude.ai/artifact/6V13DyV9sy6NtKzm4H3eDs.
Kenil's calls (19:43): Anthropic's SDK under the loop, Anthropic's server-side compaction for the
context ceiling, a $200 monthly limit on his key. Part 1 on his yes (19:44).

- `pnpm journeys --loop own` (`core/src/journeys/own.ts`): the API key read once a round from the
  Keychain through Alpha's helper (`keyOnce`), each journey given a store holding only the key;
  the desk and the small asks (reading, judging) on `ClaudeApiProvider`. Reports end in `-own.md`.
- The own loop asks the API to cache what repeats (`requestOf`, top-level `cache_control`), pulled
  forward from part 2 so a round costs about $5, not $40.
- Every report says what its journey spent so far and in all (`spentIn`, from the world's spend
  rows: Claude Code's own cost, the own loop's tokens priced from models.yaml); the summary says
  the round's cost.
- The round on his key: 25 of 27 passed, $4.20; the same round on Claude Code: 27 of 27, $4.93 at
  API prices. Failures, both the own loop's: a made-up tool name reached the gates (a-rule-holds),
  and the API refused a nullable choice in the document reader's answer schema
  (dealpilot-deal-documents). Part 5's first two items.

## 31 October: the round's two gaps fixed (part 5's first items)

Part 1 pushed (e74d72f) on Kenil's "yes lets do it" (12:57), with the two fixes next.

- A tool Alpha has not got (the model asked for `mcp__alpha__draft`) is answered "There is no tool
  called …" in `OwnLoop.call`, before the gates, as Claude Code does.
- The small asks on the key (`ClaudeApiProvider.ask`): the answer shape goes to the API rewritten
  by `engine/apishape.ts`, as the API's strict answers allow no list of types with an enum and at
  most 16 fields that may be one of several types and 24 that may be left out: each "may be empty"
  becomes `{empty, value}`, every object closed and every field required, and the answer is turned
  back (`fromApi`). A shape still too large for strict answers (the document reader's: "the
  compiled grammar is too large") is asked again as an `answer` tool the model calls once, which
  the API does not compile. The provider takes a test `fetch`; before it did, one test run reached
  the real API with a made-up key and was refused (nothing spent).
- `connectors/gmail` test: it checked that "1 Oct 2026" was gone from a sent draft, which today's
  date (31 Oct 2026) holds; it now checks the saved date line.
- On his key: a-rule-holds passed ($0.13), dealpilot-deal-documents passed ($0.21).
