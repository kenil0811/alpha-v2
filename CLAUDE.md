# Working in alpha-v2

Alpha v2 gives small businesses AI over their manual flows and legacy systems. It is a full
redesign of Alpha, started 19 October 2026. **`docs/design.md` is the reference**, agreed with
Kenil on 19 October 2026; `BRIEF.md` is the brief it was written from, kept as history. Read
the design first, then the newest entries in `docs/log/`.

## The repository

- `core/`: the service (world, engine, gates, scheduler, api, journeys runner)
- `window/`: the web app the core serves
- `connector-sdk/` and `connectors/<name>/`: the connectors
- `kits/<name>/`: the shipped kits, one module directory each
- `journeys/`: journeys as YAML; their reports go in `docs/journeys/`

Imports go one way (design §3). Internal packages are not built: Node runs their TypeScript
directly, so use erasable syntax only (no enums, no namespaces, no parameter properties).

Node 26 (`.nvmrc`) and pnpm 11. Commands: `pnpm install`, `pnpm check` (typecheck, lint,
test), `pnpm format`, `pnpm dev:core` (needs `ALPHA_HOME`), `pnpm dev:window`.

## Rules

- A failure becomes a journey before it becomes a change.
- A rule for the model is a wall in code, or it is not written.
- Nothing is built for a client who has not asked.
- Every change is proposed to Kenil in writing before it is built, built in the design's shape,
  looked at in the app, and committed after his review. The design changes only on his yes.
- One short dated entry in `docs/log/` per session.
- Tests never call the model or touch a real tenant; journeys run on a fresh tenant each.
- Never `cp` a world file: copy it with SQLite's backup API.
- `../alpha-brain` is v1: read-only reference. Reread what the design names, rewrite it, never
  copy it, never edit it.
- Open sessions on this folder, not on its parent.
