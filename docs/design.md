# Alpha: the design

What Alpha is today, checked against the code. It says what is, never how it came to be: that is
in `docs/log/`, and the long design this one replaced is on the branch
`reference/full-2026-11-06`. It changes only on Kenil's yes.

Two lists sit beside it and win on their own ground: `docs/rules.md` for who may change what, and
`docs/ui-rules.md` for the window.

## What Alpha is

Alpha gives small businesses AI over their manual flows and legacy systems. A firm gets its own
Alpha: a world that holds its data, agents that work in it, and a window to see and change it.
The runtime is the same for every firm.

- **Kenil owns what must be reliable:** connectors and shipped kits, with code, tests and versions.
  Nothing for one client lives in this repository; a client's kits and notes live in its own.
- **The model owns what must be flexible:** the firm's tables, pages, skills, schedules and ad hoc
  requests. It never builds or patches a connector.
- **The firm owns its data,** in formats other tools open (`docs/data.md`).

Alpha should be useful first. Guardrails are added as they are needed, and no limit is placed on
how much an agent looks up or does: agents judge that themselves.

## The shape

```
 Mac app (Tauri) or a browser
        │ HTTP + websocket
 ┌──────▼──────────────── the core: one Node process ──────────────────┐
 │ api       scheduler    engine (desks, tools, gates)    world        │
 └──────┬──────────────────────────────────────────────────────────────┘
        │ children, each under the sandbox
   Claude Code sessions · scripts · one process per connector · browsers · Docling
```

One process serves everything. Anything that runs code the core did not ship is a child under the
sandbox, whose proxy runs in the core: a child reaches only the hosts listed for its own process.

The data home is `ALPHA_HOME`. It holds `alpha.yaml` (what the install knows), the per-install
`token`, and `tenants/<id>/` with `world.sqlite`, `files/` (by hash), `modules/`, `agents/`,
`desk/`, `instructions/` and `backups/`. What differs by computer sits behind one `Platform`
interface in `core/src/platform/`, and `pnpm check` refuses a Mac call anywhere else in the core.

## The repository

| Folder | What it is |
| --- | --- |
| `core/` | The service, its `config/` of prompts, models, limits and words, and the journeys runner |
| `window/` | The web app the core serves |
| `kit-sdk/` | The kit contract, from which `docs/kit-api.md` is generated |
| `connector-sdk/`, `connectors/`, `connectors-extra/` | What connectors are built on, the set that ships, and those added by hand |
| `plugin-sdk/`, `plugins/` | The seam for first-party plugins, empty today |
| `mac/`, `release/`, `scripts/` | The Mac app, the installer and `alpha` command, the release and the walls |
| `journeys/` | Journeys as YAML, their reports in `docs/journeys/` |

Imports go one way: `core/src/world/` knows nothing of the engine, the engine nothing of the api.
A connector imports only the connector SDK, and the window only the api's types. Node 26 runs the
TypeScript directly, so only erasable syntax is used. No file passes 600 lines, bar the few named
in `scripts/long-files.ts`.

## The world

One SQLite file per firm, opened through `node:sqlite`. `core/src/world/schema.sql` is version 1
and is edited directly until the first client is installed; migrations start then. Every write is
a function of the world that writes its journal line in the same transaction, and nothing else
writes the file.

**Tables and rows.** Each table is a real SQLite table with a typed column per field. A field is
text, number, money, date, choice, relation, person, file, link, email, phone, notes or summary.
Every value carries provenance: stated, looked up, estimated, assumed or computed, with its source
and time. What the person said stands: no machine writes over it.

A table's shape can say more. A relation may be *part of* its row, so the part lives and goes with
it. A table may be *setup*, read by its module rather than shown as a tab. A choice may hold
several, as tags. A person field may say `per: person`, one row for each person. A summary is
worked out from the rows pointing at this one and never stored. Every table, field and view has
an `about`, one sentence on what it means and whose sentence it is.

**Alpha's own tables and mirrors.** Every table is one or the other. A mirror's rows belong to the
system its connector names, and they come and go only with that system. Alpha's own fields may
sit beside them. `docs/rules.md` has the detail.

**The journal.** Append-only lines saying who, what, when and for which turn, run or card. Each
line's hash covers its content and the hash before it, and the chain is checked at every start
and by `pnpm journal verify`. A line that writes rows carries a short hash of each value, so a value
changed in the file is found. Each daily backup leaves the newest hash beside it, outside the world. Old lines that only said something was read fold into one line a day.

**Undo.** A removed row waits whole in `removed_rows` for 30 days and Bring back returns it. Each
version keeps the line that replaced it, so Revert of a run, a turn or a line puts back what it
did to rows in one transaction. Revert is itself a line.

**Also in the world:** people and organizations, derived from the rows that name them, with hard
keys merging at once and soft matches proposed on a card; documents as chunks with their positions;
saved views; cards; tasks; rules; agents and their asks; what each use of the model spent.

The model reads the world in SQL over read-only views on a read-only connection.

Backups use SQLite's backup API, once a day, keeping the last 7 days and 4 weeks, with the modules
and files mirrored beside them. Removing anything removes all that goes with it and journals the
removal; the journal itself is never touched.

## The engine

**Desks.** Each person has a long-lived session with each agent they talk to, called a desk, and
each task given to an agent has a session of its own, called a lane. A desk speaks to the model
through a provider (`engine/provider.ts`). The one provider is Claude Code through the Agent SDK,
reached by the person's own subscription or the firm's API key, kept in the Keychain and chosen
in Settings. Alpha never sees the subscription's token. Model names are in `core/config/models.yaml`,
and each agent's model can be changed beside its composer.

**A turn** is what the model wrote and the steps between, in order, kept that way in the journal
and shown that way in the window. Streaming text goes to a live store that redraws only the turn
under way.

**Tools.** The SDK's shell, files, web and subagents, and Alpha's own, served in process:

| Tool | Does |
| --- | --- |
| `query`, `search` | Read the world in SQL, and search across it |
| `write`, `change`, `shape`, `file` | Add, change or remove rows; make or change tables and views; read and place files |
| `task`, `schedule`, `nothing_to_report` | Keep tasks and standing work; a scheduled run saying it found nothing |
| `ask`, `remember`, `memory`, `rule` | A question card; standing instructions; an agent's short facts; a rule for the person's yes |
| `list_agents`, `ask_agent`, `answer`, `stop_agent` | Agents working with each other |
| `connect`, `look`, `keep`, `run`, `guide` | Open a sign-in, see a page, keep a file in a module, run a script, fetch a grammar |

Each connector adds a server of its own tools. Each tool declares its effect, and `engine/gate.ts`
is the one place a call is journaled and put to the gates, whatever route it came by.

**Context, in four layers.** The system prompt is Alpha's own words alone (`core/config/system.md`).
At session start and after compaction come the standing instructions, the modules with their notes
and skills, tables with what a row is, files, people, connections, and the rules in force. On each
message come the clock, what changed elsewhere, open cards and a short hint of what matches. The
model fetches everything else, and a table's fields arrive with its first use in a session.

## Agents

An agent is a row and a folder (`agents/<id>/`) holding its instructions, skills, files and own
schedules. Every agent can do what the Chief of staff can; they differ by instructions, memory,
skills and model. `reach` is empty on every agent today, and one function reads it, so limits can
come later as a small change. The Chief of staff is always there, has no row, knows every agent,
and makes and changes agents without a card. A change to an agent's files is a commit, so it can be
undone from its line in the chat.

**Where an agent comes from.** Made here, in a conversation; or shipped, in one format (`AGENT.md`
with its name, title, description and model on top and its instructions below, beside `skills/`,
`files/` and `schedules/`). Alpha's own ship in `core/agents/` and are kept at every start; the
Module builder is one, and New module opens its conversation. A client's ship in their kit's
`agents/` (kit API 3). A shipped agent has a lasting key, changes only with its source, and an
update keeps its memories, conversations, its own files and the model picked (`docs/rules.md` G1,
G2); the firm adds to it through memories and How to work. One deleted stays deleted. Removing a
kit keeps its agents, made here from then on, or deletes them.

**Working together.** An agent asks another with a brief, and gets one answer in a fixed shape.
One request stops at 8 asks or tasks given, or 4 hops in a chain, then waits for Continue. Alpha
counts these, not the model. What an agent does for a teammate stays out of that agent's chat. A
message naming one agent goes straight to it, and its answer is the reply.

**Memory** is short facts written during a conversation, read at session start, and shown on the
agent's page. How-to knowledge is skills, which agents can write for themselves.

## Tasks and schedules

**A task** is one piece of work: a title, a state, a place it concerns, what it touches, an owner,
a due day, a reminder and a repeat. Given to an agent, it runs in its own thread with up to 4 at
once per agent, and the rest wait in To do. The thread ending well makes it Done. A card or a
failure makes it Waiting, with Run again. A due day alone is information. A task can be told to
start later, and each copy of a repeat given to an agent starts on its own day.

**A schedule** is a file, `schedules/<name>.md`, whose front matter says when, what it runs and
what it may touch, and whose body is its brief. It sits in a module or in an agent's folder. When
is an hour, a day, a weekday, a named day, a week, a pattern, a table changing, or a document filed.
The scheduler ticks once a minute, and a background job that fails says so: a journal line each
time and a card on Home after two in a row, or at once for a backup. One run of a schedule happens at a time, a missed run becomes
one run, and a schedule with 24 runs in a day stops until the next.

**What a run does.** A module's script runs in the sandbox under the walls of its file. A schedule
that wakes an agent first runs its check, when it has one: a script that returns no wake, or wake
with what it found. A check only looks, and costs nothing. A wake opens a task in a fresh thread,
told what to do, what was found, how late it is and what it reported last. It reports on the
task's page, on Home and in a notice, never in the agent's chat, though the agent knows what it
reported. A run with nothing worth telling closes silently, and a run cannot make or change
schedules. A run still open holds the next, and they become one.

## Cards, rules and walls

**Walls refuse; gates ask.** A rule for the model is one or the other, in code, or it is not
written.

**Three gates** are the only gates: anything that leaves the firm's world, deleting the person's
own entries when they did not ask, and a sign-in. A gate opens a card with a preview, what it
rests on and what cannot be undone. The call does not run. The person's yes lets the same call
through once when the model makes it again, so a yes outlives a turn and a restart.

**Rules** come before the gates. A rule is an allow or a deny, approved by the person or inferred
by Alpha, covering a call in parts code can match. An approved deny refuses with no card. An
approved allow lets a gated call through. Only the person approves a rule. Always on a card is an
approved allow for exactly one kind of thing, offered after three unchanged yeses.

**The web** (`docs/rules.md` L1): agents and their scripts open any site with no card, and a deny
rule closes one. "Ask before agents and scripts open a new website" in Permissions, off on a fresh
install, turns on the web check: an agent opens a link it was shown, or a site on its list
(`sites.yaml` in its folder, shared with its scripts and shell) or named by the person, with no
card, and a link it wrote itself to any other site is a card, since what is in an address reaches
that site. A yes puts the site on its list.

**Walls** include the sandbox's paths and network, read-only SQL, the journal refusing change,
secrets never in the world, the builder's walls in `engine/tools/walls.ts`, and what a schedule's
file lets it touch. The window shows a refusal beside what was pressed.

## Connectors

A connector is a package written against the SDK, in its own sandboxed process, holding no secret
of the core's. Its manifest names how it signs in and the hosts it reaches, and each tool names
its effect, its card and its words. The SDK gives every connector pacing, retries for reads only,
cursors, a journal line per call, provenance on what it lands, and the human-pace browser. It
stops at any check page and never disguises itself.

A connection is connected, needs sign-in, not working, paused, or waiting for the customer. Signing
in is as the person, so Alpha reaches only what they can. Each action says whether it can be
taken back, so Revert can cover what left Alpha. Packs from outside are signed with Kenil's key and
checked at every start.

Gmail, Outlook, files and the Mac's own apps ship; LinkedIn is added by hand. On a hosted Alpha,
connectors run on the server unless they physically cannot, and those run in a small Bridge app on
the person's computer, built when a module first needs it.

## Modules and kits

A module is a folder kept as a git repository: `module.yaml` with its business case, tables, views
and sites, then `NOTES.md`, `pages/`, `skills/`, `schedules/` and `files/`. A module may sit inside
another. A kit is a module with no person's rows, and the kit API is version 3, which adds the
agents a kit carries; version 2 kits still install (`docs/kit-api.md`).
Scripts are plain JavaScript in the sandbox, importing nothing of Alpha's and handed one `alpha`
object. They are deterministic, and the model is reached only through named calls.

Every module is open, the firm's to change, or managed, changed only by a newer signed pack. On an
update, what the person changed is kept and nothing is deleted. `pnpm kit check` and `pnpm kit test`
try a kit before it installs, and tests record the model's answers rather than call it.

Pages are HTML files drawn in a sandboxed frame with no network. They read the module's rows
through the window, use the kit's blocks for their look, and print to PDF.

## The window

The rail has Home, Agents, Tasks and the modules, with Intelligence and Settings at its foot. The
assistant starts closed and opens beside any screen from Alpha's face at the right of the bar. Home is what needs the person, today's
tasks and what was recently completed. The chat looks and feels like Claude Code, in a blue accent.
Tables are one grid with saved lists, and a row, task or schedule opens beside the page. Rules for
all of it are in `docs/ui-rules.md`, held by `window/src/look.test.ts` where code can hold them. The
Mac app is WebKit, so what is seen there is the proof, not a Chromium pane.

## People and hosting

On a Mac, the per-install token signs the window in. With `sign_in: true` in `alpha.yaml`, each
person signs in with a name and password or Microsoft for 30 days, and every request acts as that
person. Their conversations and cards are theirs. Two roles exist: only the owner sets the model
and the data, says who may sign in, and installs a pack.

Clients are hosted, and nothing is installed on a client's computer. A server is one Linux virtual
machine per firm, not a container, because Anthropic's sandbox in a container needs a much weaker
mode. `pnpm server` sets one up from the Mac and sends it a signed release when pressed, and a
release that does not start goes back by itself. Secrets are one encrypted file whose key is sealed
to the machine. Tailscale gives it an https address, private to devices signed in to the owner's
Tailscale, or open to the internet through Funnel on the owner's word (`pnpm server address <ssh> public`),
each person still signing in. A site's sign-in is a live picture of the server's browser in the window, so
Alpha never holds the password, and Claude comes as a subscription token from `claude setup-token`.
Before the first client: the firm's own API key, off-site backups and a heartbeat. The Mac's installer is a self-installing disk image and the `alpha` command.

## Proving it

- **`pnpm check`:** types, lint, tests, the time-zone tests, the walls and `pnpm rules`. Tests never
  call the model or touch a real tenant.
- **`docs/rules.md`:** each rule says how it is held, and its test tries it through every door in
  `core/src/rules/doors.ts`. A route or tool that writes must be listed there.
- **Journeys:** YAML steps and checks on the world, each on a fresh tenant with the real model,
  never reading the model's prose where the world can answer. `pnpm journeys` runs them all, and
  a client's run from its own repository. A failure becomes a journey before it becomes a change.
- **A look:** the real app, on an empty home, with exact test steps, before anything is pushed.

## Working rules

`CLAUDE.md` has these in full. Every change is proposed in writing first, built in this shape,
looked at in the app, and committed after review. Prompts, models and judgements live in
`core/config/`, never as constants in code. Nothing is built for a client who has not asked.

**Deliberately absent:** a second provider or Alpha's own loop; cards to make an agent; built-in
characters beyond the Chief of staff and the Module builder (Kenil, 10 Nov); numeric limits on an agent's looking; anything installed on a client's computer.
