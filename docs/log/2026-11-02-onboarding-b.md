# 2 November 2026: onboarding B, the closer look

Kenil's yes of 12:40 to B: onboarding should learn as much about the person as it can (who they
are, what they do, the manual work they do often, what would help, questions), so one session
looks closer with read-only tools instead of one draft from the summary alone. Sensitive things
never leave; what leaves is kept with the run and Forget deletes it.

- The core: the plugin host gained `explore`: one session on the person's own route with only the
  plugin's read-only tools (Claude Code: the plugin's in-process MCP server, `allowedTools` and
  nothing else; Alpha's own loop: those tools and an answer tool), every call kept with what it
  returned and given its id as it starts (`t1`, `t2`…), its cost in Usage under the plugin's
  module. One bound, `explore_turns` (80) in `limits.yaml`, never shown, so a session that never
  settles ends; and `explore_look_tokens` (200,000), since Claude Code otherwise sets a look over
  25,000 tokens aside in a file the session cannot read.
- The readers: each time an app was in front (`appSpans`, from Screen Time), and where each
  download came from (`downloads`, Spotlight's `kMDItemWhereFroms` and `kMDItemDateAdded`, no new
  permission). The connectors gained `browsing.visits`, `apps.spans`, `filenames.names` and
  `filenames.downloads`, each through the shared filters (sites and scrubbed titles, never
  addresses; the never-use list out).
- The plugin: `sources.ts` reads once a session; `tools.ts`, `people.ts` and `count.ts` are the
  eight tools (day, sites, apps, files, mail, calendar, contacts, search), in the person's own
  zone; `answer.ts` the answer's shape (about, routines, suggestions, questions) and its checks
  (every item cites the overview or a call; a kit or connector Alpha has; no site or file name
  nothing read held; a line proposed before never again). Routes: Look (starts the session, which
  runs on), the run (Show the work), Forget, Answer (a question's answer kept as the person's
  own line), About you's keep, edit and drop. The summary's halving for a model that could not take
  it all went: nothing is cut.
- Tests: the filters, the Mac reader's download sources, every tool on made-up rows, the checks, the
  routes with a scripted model, the seam on a real world, and the session on Alpha's own loop.
- The first run on Kenil's data (13:43, his go): 55 s, 14 looks, about $0.93; 11 lines, 4 routines,
  6 suggestions, 4 questions, none dropped. His word: "looks pretty decent overall".
- One gap it showed: a mail subject about bank statements reached Claude, since the never-use list
  ran only on sites, apps and files. On his yes the list moved to `connector-sdk/src/never.ts` (one
  rule, the connectors' filters use it as before), the plugin host gained `never(words)` (the
  shipped list and every list the person keeps on a connection), and onboarding leaves out any
  message whose subject, attachments, sender or recipients touch it, and any meeting whose title or
  place does, from the overview and from every tool.
