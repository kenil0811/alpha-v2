# 2 November 2026: onboarding 4b, the summary and the draft, as a plugin

Kenil's yes of 12:23, with his call of 12:22: no size of our choosing (no 36,000-token cap, no
twenty kept lines, no caps on the draft); what is checked is truth.

- The plugin host gained two read-only calls: `catalogue()` (Alpha's modules with their business
  cases, its connectors and whether each is connected) and `people()` (the people the person deals
  with, the world's own counts). A plugin refuses in the person's words with the SDK's `Refusal`,
  said as the core's refusals are (409).
- `plugins/onboarding/`, the whole of onboarding's core side, using only the host:
  - its own module, About you (`kit/`, inside Alpha's): Line, From, Sure, State, Noticed on; Kept
    and Proposed views;
  - the summary (`summary.ts`): the person, calendar, contacts and mail from the tables their
    connections fill, browsing, apps and file names from the three connectors, and what Alpha can
    set up, every fact a line with an id; everything counted goes in; only when the model refuses
    the prompt as too long is it sent again with the least-seen half of the sites (no titles) and the
    oldest half of the names left out;
  - the draft (`draft.ts`, `onboarding.md`): one question, no tools, a schema; then the walls: every
    line and suggestion cites ids the summary holds, a module or connector suggested is one Alpha has,
    a site or a name the summary never held is not let through, a line proposed before (kept or
    dropped) is not proposed again;
  - its routes: summary (built and kept, never sent), draft, the run, forget, the About you rows and
    keep, edit (kept in the person's words) and drop; every kept line starts every conversation;
  - its runs in the plugin's own folder (what was sent and what came back), Forget deleting them; the
    journal says counts only.
- Tests: the package against the host's contract (a made-up host), and through the real seam on a
  real world (`core/src/plugins/onboarding.test.ts`).
- On Kenil's Alpha: the plugin loads, About you sits inside Alpha; browsing, apps and file names were
  connected on it; his real summary was built in 4 s and written to
  `.data/onboarding-summary-2026-11-02.md`, nothing sent: about 16,000 tokens (1 line on the person,
  1 calendar, 2 contacts, 76 mail, 138 sites, 110 apps, 378 file lines, 18 of what Alpha can set up).
