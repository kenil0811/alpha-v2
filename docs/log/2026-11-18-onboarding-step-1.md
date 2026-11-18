# 18 Nov 2026: Onboarding, step 1 (journeys first)

The first of the onboarding plan's build steps (plan doc 22346f13, "Bringing onboarding back";
Kenil answered calls 1 to 49 and said "looks good" on 18 Nov). Built straight from the list, as
call 46 says. Five journeys, written before any of the plugin, each failing until the build
passes it:

- `an-interview-gets-to-know-you`: the owner of a made-up renovation firm, on recorded mail (31),
  events (13), contacts (10) and browsing visits holding ChatGPT's and claude.ai's titles, a
  lent folder they skip, and a made-up site. Checks: what is allowed is read, the report's rows
  each cite what they rest on, each workflow closes, hours are computed or estimated with their
  basis, the skipped folder is never cited and its file's name appears nowhere, How to work holds
  only what the person kept, and the proposal they declined is never put again.
- `an-owner-says-who-alpha-is-for` (a dental practice with a site, in the owner's word
  "practice") and `an-owner-who-works-alone-says-who-alpha-is-for` (a Gmail address, no site):
  call 10's two ways, as two journeys since each runs on its own tenant.
- `a-quiet-month-wakes-no-one`: the check 31 days on finds nothing and leaves no task.
- `an-alpha-without-interviews`: no plugins line, no trace (call 47). It passes today, trivially,
  and holds from step 3 on.

The runner gained what they need, generic: a journey's `plugins:` (only those load), a `plugin`
step through a plugin's routes, an `interview` step answering an agent's cards by pattern,
Contacts and browsing on the stand-in computer, `due` some days on, and checks on How to work,
citations, skipped sources, numbers, cards asked once, and no trace of a plugin. The schema moved
to `journey.ts` and the row-value checks to `cell-checks.ts`, for the 600-line wall.

What the journeys fix for the later steps: the plugin's routes `home`, `start` and `finish`; source
cards whose words start with the source's name; About you as a card of lines (a review card,
Keep and Drop per line); report rows in "Your work" with a "Rests on" field, one citation a line
(`row <id>`, `answer <card id>`, `page <address>`, `file <hash>`, `line <id>`); How to work lines
journaled as `remembered` in the person's name.

What the runner still lacks: the stand-in computer cannot lend a browsing history until the Bridge
has its browsing reader (step 9), so the first journey cannot pass before then. Its fixtures'
dates are fixed in Sept to Nov 2026, so a 90-day lookback will need them moved later.
