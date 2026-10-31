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
