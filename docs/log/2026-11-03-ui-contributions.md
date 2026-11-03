# 3 November 2026: a guide for UI contributions

Kenil's ask of 19:02 and his notes of 19:27 to 19:32: someone contributing to the UI and UX,
working through AI agents, merges window changes into `main` on their own review; anything that
could reach the core goes to a long-lived lab branch, from which Kenil picks ideas and builds them
into `main` himself. No names in the guide.

- `docs/ui-contributions.md`: two lanes decided by one question (could Alpha save, change,
  delete, send or decide anything differently, or fail, slow down or lose data where it did not
  before?), signs for the lab rather than locked folders, a test home for running it, conflicts
  rebased and resolved with both sides kept, how to look at a change, and a block to paste into
  an agent.
- `.github/pull_request_template.md`: the lane and the "core untouched" checklist on every pull
  request.
- `CLAUDE.md` points a contributor's agent at the guide. A UI rule now changes in the change that
  needs it, by Kenil or a contributor; `docs/ui-rules.md`'s opening says the same.
- Left to Kenil on GitHub: the `ui-lab` branch, a ruleset on `main` (a pull request, the check
  green, no force push, his own pushes bypass) and one on `ui-lab` (no force push or deletion).
  Rulesets on a private repository need GitHub Pro.
