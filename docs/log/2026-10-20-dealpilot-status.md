# 20 October 2026: DealPilot reads a listing's status at the source

Kenil's run on POE Advisors had shown it: some listings say Acquisition Pending or On Hold, and
the listing reader marked every listing it found Listed. Plan agreed at 14:48 ("yes makes
sense"), with one Run now of POE on the test copy.

- **alpha-v2 (generic):** a kit update gives a choice field a newer version's new choices, each
  after the kit's choice before it; none is taken away (`modules/kits.ts`, tested).
- **DealPilot 0.1.2 (alpha-avilo):** Status at source is Listed, Under LOI, On hold, Sold or Gone
  (amber for Under LOI and On hold, red for Sold and Gone). A source that shows a status reads it
  as the field Status at source, and its agent's `statuses` says what each of its words means;
  a word not mapped is kept as written in As listed and the run says so, never guessed. Gone now
  follows any open status, not only Listed. A deal past New that changes status or goes is told
  on Home. Figures counts a new fit only for a deal still Listed. NOTES.md tells Alpha to map a
  new source's words. The reader also takes the test copy's fix (a preview needs no Sources row).
- **Journey:** Harbor's made-up listings show For sale and Under contract; Alpha mapped them to
  Listed and Under LOI unprompted, and `dealpilot-a-source` passed with the two new checks.
- **The test copy:** kit updated to 0.1.2; its reader (Alpha had edited it) replaced by the kit's,
  which carries that edit; POE's agent given `Status at source` (`td.status`) and its words (For
  Sale, On Hold, Acquisition Pending). One run of POE: 46 seen, 9 changed, 0 gone; 39 Listed, 8
  Under LOI, 1 On hold, no word unmapped.

## Every source's reader in the kit

Kenil, 15:46: "Can we put all readers in a good shape in the kit? so someone installing it fresh
can just start using it?" Agreed: readers start paused (with Turn on all), and sign-in sites get a
Sign in card.

- **alpha-v2:** Turn on all / Pause all for a module's agents (`POST /api/modules/:id/agents`, in
  Settings and Agents and notes). A reader that meets a sign-in opens a card (gate sign_in, tool
  `site_sign_in`, one per agent and site); its Sign in opens the site in a window of Alpha's
  browser (`BrowserEngine.signIn`, now wired: `POST /api/cards/:id/sign-in`), and closing it
  answers the card and runs the agent again. `extract` with an ID pattern that finds nothing
  gives no ID, never the whole text.
- **DealPilot 0.1.3:** twelve readers in `agents/` (POE Advisors, Accounting Biz Brokers,
  Accounting & Tax Brokerage, Fusion, Saint Louis Group, Grand, Kendall, Premier, VR Gateway,
  Metro, Innovative, Website Closers), built by looking at each site with Alpha's own browser
  (`core/.readers/site.ts`, local, not committed). The reader gained `id.prefix` (a site's own
  numbers never meet another site's), `pages.pattern` (Accounting Biz Brokers: a map linking 44
  state pages, each read as a list), and reads a listing with no status word as Listed. APS and
  Kumo need a sign-in; their readers wait for the person to sign in once.

Kenil, 15:29: "I do want reading for everything." Three of the six sources first left Off were
our bug: `robotsAllow` cut a rule at its first `*` (`Disallow: /*_rsc=` became `Disallow: /`).
It now reads robots rules as RFC 9309 does (`*` and `$` as patterns from the path's start, groups
of several User-agent lines, longest match, Allow on a tie), with two tests; APE's, Capstone's and
Transworld's real rules allow their listings pages. APE and Capstone got readers; Transworld, once
past robots, answers 403 like Sunbelt, BizBuySell and Quiet Light, so those four stay Off and
are never worked around (their alert emails through Gmail were offered instead). The reader
gained fields read from several places and joined (APE's city and state), a name without its
status word (Capstone's cards), and leaves out a listing first met already Sold or Gone as
history (APE keeps every sold listing on its state pages; the Harbor journey has a sold one).

With fourteen readers in the kit, the source journey's `agents: 'on'` turned them all on and its
due step read the real sites. Stopped, and walled: a journey's browser reads only 127.0.0.1 and
localhost (`BrowserEngine` `only`, with a test), and a journey's kit step can name the agents it
turns on (`agents: [Figures]`). Rerun, Alpha gave Harbor's HP101 a prefix (HARBOR-HP101), so the
keyed checks missed: the skill page now says a prefix is only for bare numbers, page names or a
code shaped like another source's (ABB beside POE), and a code in the site's own letters is kept.
The journey now says Summit is a business broker, as it says Harbor's kind, since Alpha rightly
asked; it passed (alpha-avilo docs/journeys 2026-10-20-1617), the sold HP104 left out.

Kenil, 16:04: his Alpha's world went to the Trash ("Alpha world 2026-10-20 17h") and DealPilot
0.1.3 was installed on a fresh one: 20 sources, 14 readers and Figures, all paused.

Kenil, 16:41, on Settings › Kits and agents: the agents fold under their module (the name opens
them; the line under it says how many and how many are on), and the list of sites a module's
readers may read is gone from the page and from `WorkingModuleView`.
