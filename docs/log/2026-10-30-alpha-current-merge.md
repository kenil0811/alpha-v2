# 30 October 2026: alpha-current brought up to date

`claude/alpha-current` rebased onto Kenil's main (to cef0095), then `claude/module-overview`
(b98c39a, the 29–30 Oct window and skills work) merged in. Where module-overview and
alpha-current's older copies of the same 27–28 Oct work differed, module-overview's stands; where
it met Kenil's work, both stand.

- Usage: Kenil's spend rows are the one store. Settings › Usage is `UsageSection` a month at a time
  (I3); the Agents list and an agent's page read their week's cost from `GET /api/usage/agents`
  (`spend.byAgentSince`). Module-overview's journal-counted `UsageView` is gone.
- The workspace skills' model asks (interview, research, governance, builder) are spent under
  their run, as `judge` and reads are.
- The business case: one wall, `caseFirst` in `engine/tools/walls.ts`. The Builder asks it for the
  module a build lands in, so a module with a business case needs none again; Build it carries the
  case to a new module's first table and keeps it in module.yaml (`setBusinessCase`), not NOTES.md.
- Needs you: the one list's sign-in row says a connection waiting on the customer, and one that
  signs in with Microsoft opens its page. A question card's detail is words, under the card's link.
- A module's Agents and notes: the business case at its top, then the arranged blocks; Tables keeps
  Keep as a tab and People's columns. A table opened as a row's parts (`?of=`) and a chart's
  filter (`?why=`) both hold.
- Settings › Experimental: the developer switch at its top; no empty-state sentence under it.
- Alpha's kit is 0.5.1, above both sides (0.3.2, 0.5.0).
