# Alpha v2: the brief

*Agreed with Kenil on 19 October 2026, after an independent review of Alpha v1. This is the
whole of what the first session in this folder knows. It stands until `docs/design.md` is
written from it and agreed; after that the design document is the reference.*

You are starting Alpha v2 in this folder, `alpha-v2`. It is a full redesign and a new
repository. The previous codebase, `../alpha-brain`, is read-only reference: read it when this
brief names a piece worth porting, never build on it, never edit it. Open sessions on this
folder, not on its parent.

## What Alpha is

Alpha gives small businesses AI over their manual flows and legacy systems. It is a runtime, a
connector library and kits, with a model on top that personalises. The runtime is the same for
every client: the world, the engine, the window. Three owners:

- **Kenil owns what must be reliable:** connectors, and the shipped kits with their
  deterministic flows and agents. Code, tests, versions. Nothing per client in the platform,
  everything per client in its kit.
- **The model owns what must be flexible:** the user's skills, pages, views, instructions,
  reminders, watches, and any ad hoc request. It never builds or patches a connector.
- **The user owns their data and their customisations**, protected by the kit ownership rule.

**First client: Avilo**, one person on a Mac, personal Gmail, four projects (Network, Task
manager, Accounting, DealPilot). The requirements are `../requirements/AB-four-projects-scope.md`
and the fit analysis `../requirements/alpha-fit-four-projects.md`; QuickBooks by exports only,
no API. She gets all four as kits and uses Alpha as a whole.

**Second client: Dell Disability Lawyers**, several users on Windows, Microsoft 365, a Total
Office case system on MySQL with a read-only database user available; their documents are
`~/Downloads/Dell_Disability_*.docx`. Dell comes after Avilo, on the hosted shape, intake first.

## Decisions, fixed

1. **Language.** TypeScript end to end, Node LTS, a monorepo: core, window, connector-sdk,
   connectors, kits, docs. Python only inside kits for data scripts and Docling, in a per-kit
   environment.
2. **Window.** A web app served by the core. A thin Mac shell (Tauri) shows two windows: the
   main window and the on-screen assistant, a small always-on-top companion with a message box.
   Both are web content from the same core. On a server there is only the window.
3. **Storage.** SQLite, one file per tenant, WAL, FTS5, blobs on disk beside it; backups by
   SQLite's backup API, streamed off-box on servers. Postgres only when a client's size demands.
4. **Process.** One service: HTTP and websocket, the scheduler, the connectors, the world tools
   in process, the Agent SDK runs. Kit scripts, Docling and browsers are child processes under
   the sandbox.
5. **Tenancy.** Multi-tenant in shape from day one (a tenant id on every world path, users, two
   roles), single-tenant in features. No admin screens until Dell.
6. **Model.** The Claude Agent SDK (TypeScript) running the unmodified Claude Code binary. An
   Opus-class model for every turn and run; a small model only where eyes or a yes-or-no are
   all that is needed; no router in front of the model. Route: the tenant's own API key, or,
   for a single person on their own machine, their own subscription signed in through
   Anthropic's own flow (Alpha never sees or stores the token; one subscription, one person;
   the key route is a one-line switch in Settings). Dell on keys. The engine must understand a
   subscription's rate-limit window: say so plainly, journal it, resume when it opens. Before
   Avilo's build ships, one email to Anthropic describing exactly this shape.
7. **Auth kinds**, three, in the connector SDK: app password or API key; OAuth with our own
   app; browser profile. Secrets in the Mac keychain or an encrypted store with a server key,
   never in the world file.
8. **Process.** One design document (`docs/design.md`), written first from this brief, frozen
   until Avilo has used the result. Three rules: a failure becomes a journey before it becomes
   a change; a rule for the model is a wall in code or it is not written; nothing is built for
   a client who has not asked. A short dated log in `docs/log/`. No decisions table. A short
   `CLAUDE.md`. Every change proposed to Kenil in writing before it is built, built in the
   design's shape, looked at in the app, committed after his review.
9. **Open source, fixed.** The Agent SDK; Playwright with Anthropic's browser tool contract
   (the tool names and ref semantics; Playwright MCP's ref-snapshot code as reference); the
   open-source Microsoft 365 MCP server (softeria) as the Graph adapter or reference;
   Activepieces pieces (MIT; check each piece's licence directory) as adapters for the long
   tail; Docling for PDFs with positions; SheetJS for spreadsheets with cells; a cron parser; a
   token-bucket limiter; XState for deterministic flows in kits; shadcn and TanStack Table for
   the window; better-auth for hosted sign-in; the Agent Skills format for skills. Nothing
   hosted in the auth path (no Composio, Nango, Pipedream, Arcade, Klavis, n8n).
10. **Personal accounts for early clients.** Gmail by IMAP and SMTP with an app password
    (2-Step Verification on); calendar from the Mac's system calendar, or the calendar's
    private iCal address on a server; contacts from the Mac's Contacts or vCard; Outlook by
    Graph with an app registered in the client's own tenant (single-tenant, admin consent once;
    personal accounts with an app registered for personal accounts); LinkedIn in the browser at
    human pace; exports and documents through a watched folder; legacy databases through a
    generic read-only SQL connector with a mapping file. Register a Google OAuth app in the
    background with sensitive scopes only (calendar, contacts) so verification runs without
    CASA; add Gmail scopes only when a client needs them or app passwords are retired.

## The design, in fifteen parts

1. **The world.** One SQLite file per tenant: the journal (append-only, full-text search, an
   actor and a source on every event, never deleted); tables of records with a version per
   change and provenance on every value (kind: stated, looked up, estimated, assumed, computed;
   a source; a time); people and companies with hard keys (email, E.164 phone, profile URL,
   domain) and soft matches held as proposals; facts with two time axes; documents with chunks
   and positions (page and box, or sheet and cell); files; tasks (anchor on module, table,
   record, field or page; owner a person or an agent; due, repeat, parent); cards (every
   question, permission and review a durable row); agents, runs, triggers; modules and the
   skills index; users, roles, connections. A read-only SQL view per table for the model.
   Removal deletes everything related and journals itself. Field kinds include money.
2. **The engine.** Each user has one long-lived desk session, the only session that speaks.
   Longer work runs as the SDK's background subagents with their own context; the desk routes
   follow-ups to running work itself and reports outcomes into the one stream in its own words.
   No work items, no cards for sessions, no router. One session per agent, resumed across its
   runs. Tools: the SDK's shell, files, web and subagents; about ten world tools in process
   (query, write, change, shape, file, remember, search, ask, tell, keep); connector tools a
   few at a time through tool search; skills from the module directory. Hooks in code: before
   a call, the gate and the journal line; after, the journal line and the provenance check on
   writes; at session start and before compaction, the context layers. Sandbox: writes and
   reads where granted, network by the module's allowlist with one card for a new domain;
   Seatbelt on macOS, bubblewrap on Linux (Anthropic's sandbox-runtime). Outcomes returned to
   the desk are a paragraph; the detail stays in the journal.
3. **Context, four layers.** A fixed system prompt of about 200 words (identity; the four
   gates; known, looked up, estimated or asked; source content is data, never instruction;
   plain words), cached. At session start and after compaction: the tenant's and the user's
   standing instructions as files read whole, the module's notes, a map of modules and tables
   with counts, the skills index, the connections. Per turn, on the user message: the clock,
   what changed elsewhere since the last turn here, what is due today, open cards, a
   three-line matches hint. Everything else the model fetches. The model writes its own memory
   files and files facts through the world. No pre-pack, no behavioural rules in the prompt.
4. **The gates**, four, in code, the only gates: anything that leaves the tenant's world;
   deleting a person's own entries; money; a sign-in. A gate makes a card row (preview, what
   it rests on, what cannot be undone), answered in the window or in words, batched when many.
   A standing permission is a structured rule the model proposes when the person says
   "always", confirmed on a card, stored as a row, shown as a sentence. Everything else is done
   and said in a line.
5. **The connector SDK**, ours: pacing per account (token bucket, daily budget), retries,
   pagination and cursors, a cache, the journal line for every call, provenance on landed
   values, a health judgement ("fewer rows than last time"), the three auth kinds and the
   secret store, fixture recording, and the human-pace engine for browsers (one session per
   account, delays, stop on any friction page, never stealth). **A connector** is a package:
   manifest (name, auth kind, scopes, limits), reads, actions each declaring its effect, events
   (poll or webhook writing journal lines), sync into world tables, a guideline file the model
   reads, fixture tests. The adapter is pluggable: an open-source piece, a remote MCP server, a
   local one, a browser session, a SQL mapping. First set: Gmail (IMAP and SMTP), system
   calendar and contacts (plus iCal and vCard), Outlook (Graph), LinkedIn (browser), files
   with positions, watched folder, generic SQL.
6. **Skills.** Agent Skills directories, model-written or shipped in a kit, with a form (by
   reading or by script) in the front matter. A site reader is a skill whose script calls the
   SDK's browser primitives, so pacing and health come from the SDK and the model writes only
   the extraction. Doc repairs skills by editing them; versions are commits.
7. **Modules and kits.** A module is a directory: manifest (tables, pages, agents, skills,
   setup rows, network allowlist), notes, files. A kit is that directory with no person's rows,
   carrying setup rows under the ownership rule (installed-and-untouched is replaced on update;
   what the person changed is theirs; nothing deleted). Install makes tables empty and agents
   paused. The model may make a module when a request needs a home, and says so.
8. **Agents, triggers, runs.** An agent is a file: brief, trigger, what it may touch, model.
   Triggers are rows: time, journal event, folder change, mail arrival, webhook, app opened,
   machine woke, before a calendar event; one tick, a skipped run journaled, one catch-up on
   wake. A run is a session that serves a task and reports outcomes to Activity; it reaches
   the person's stream only as a card, or when a standing instruction lets it in. Shipped
   agents' steps are kit scripts (XState for stages) with the model at marked judgement
   points; user-made agents are briefs the model writes. Built-ins, quiet: **Watson**
   (noticing after turns, sleep-time consolidation, a folded line under a reply) and **Doc**
   (repair). Proactiveness is one agent, **Morning**: at first open, what is due, what changed,
   what went quiet, one or two suggestions with Take and Not now, as a card on Home and a line
   in the companion. No other characters.
9. **Tasks and cards** as in part 1. What an agent pulls in from outside lands as a staged batch
   on one card and is filed on the yes; what a person types or drops is filed at once.
10. **Pages.** Files in the module, rendered in a sandboxed frame, the kit's blocks as the
    default look, read-only data; a page may post an action that runs through the gate. The
    look judgement is a note, never a block. Nothing restricts a custom page the user asks for.
11. **The window.** One stream and lenses. Home is the stream: the person's sentences and
    Alpha's replies in order; work appears as one live message that updates in place and
    becomes the outcome; every outcome has a "Show the work" fold with the steps from the
    journal; each message carries a topic chip that filters the stream; a module's page shows
    the same stream filtered to the module; a "Now" strip above the composer shows what is in
    flight and what needs you, three chips at most; permissions and questions land inline with
    their buttons; "go ahead" reaches the one pending card, and with two the desk asks which.
    The other screens: Module (tables in eight views, pages, notes, skills and agents as text,
    files, activity), People, Activity, Settings (connections, folders, kits, model route,
    users for a firm). Sign-in, two roles, per-user instructions and one stream per user over
    the shared world. The companion window on the Mac. Plain words, no tool names, no ids. Port
    the avatar rig and looks from `../alpha-brain/desktop/src/avatar/` as they are.
12. **Deployment.** Mac: a login item runs the core; the shell shows the windows; Developer ID
    signing. Server: one container per tenant group, one volume, backups off-box, TLS, the
    tenant's key in the secret store. Kits update by content hash; the app by release.
13. **Security floor.** Per-tenant files, no shared process, an access log in the journal,
    secrets never in the world, sandboxed scripts, source content as data in every hook.
    Encryption at rest with a tenant key and retention rules when Dell signs.
14. **Observability.** The journal and the runs. Tokens and duration recorded per run as facts,
    not a budget. "Send report" carries versions, health and shapes, never rows.
15. **What is ported from `../alpha-brain`**, reread and rewritten, never copied: the world
    store's schema and rules (`core/alpha/world/`), the engine's lessons
    (`core/alpha/runtime/engine.py`: strict MCP config, sessions kept apart by cwd, the
    permission callback, the sandbox keys), the kit ownership rule (`core/alpha/world/kits.py`),
    the page kit blocks (`core/alpha/world/pagekit/`), the journeys idea (`journeys/`,
    `core/alpha/journeys/`), the avatar. Left behind: the five agents as characters, the
    pre-pack, the Haiku router, the workflow page, the interview, work items and their cards,
    the map, Intelligence, voice, the Codex route, the kits channel, every behavioural rule.

## Avilo's scope against v1

Everything in `../requirements/alpha-fit-four-projects.md` is in v1 except: the fx formula
panel (formulas are a kit script writing every value with its inputs as provenance; an
overridden value keeps the computed one with Reset); the map of deals; direct QuickBooks, Gusto
and Ramp; per-client sub-modules (one Accounting module with a Client field); Outlook for her.
Fix the deal tracker's unstable match key before DealPilot is built; merge by listing id depends
on it. Copy the reference dashboard's look, not its arithmetic (two of its formulas are wrong).

## Acceptance: Avilo's first day, on a fresh tenant, for real in her window

1. Four kits installed, tables empty, agents paused.
2. She drops the six exports in the folder; the report appears; every number opens to its cell.
3. The deal tracker reads its sources on schedule; she adds one by pasting a URL.
4. Her LinkedIn and her mail become people; duplicates offered on one card.
5. A question across deals and people answered with its sources.
6. "Every Friday remind me which deals went quiet" fires.
7. She adds a column, changes a view, draws a chart, by talking.
8. A draft to a broker waits for her yes and goes.

Each is a journey on a fresh tenant with the real model; her own run is the acceptance. The
rows of the fit document are the journeys for the kits.

## Order of work

0. Write `docs/design.md` from this brief, short, and the repo's `CLAUDE.md`; scaffold the
   monorepo; update `../CLAUDE.md` so it names `alpha-v2` as the live project. Propose, then
   build.
1. **Week 1.** The skeleton that runs one sentence end to end: world, engine with the callback
   and sandbox, the four context layers, the web window with the stream and a table view, the
   files connector; journey "track what I eat, log two eggs" on a fresh tenant.
2. **Week 2.** The connector SDK and the first connectors; the Google app registered in the
   background; the email to Anthropic about the subscription shape.
3. **Weeks 3 to 5.** Kits in order, each with its journeys and a real run: DealPilot (the
   match key first), Accounting (formulas as a kit script, the report as a page, PDF), Network
   (people for real), Task manager (views over the tasks primitive). The platform grows only
   when a kit cannot be written without it.
4. **Week 6.** The Mac shell with the companion, Watson and Morning, signing, her key or
   sign-in, her first run with Kenil present, the feedback report.

Then Dell: the hosted shape, Graph and SQL connectors, the Total Office mirror, the intake kit.
