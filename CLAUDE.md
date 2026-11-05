# Working in alpha-v2

Alpha v2 gives small businesses AI over their manual flows and legacy systems. It is a full
redesign of Alpha, started 19 October 2026. **`docs/design.md` is the reference**, agreed with
Kenil on 19 October 2026; `BRIEF.md` is the brief it was written from, kept as history. Read
the design first, then the newest entries in `docs/log/`.

**Working for a UI contributor rather than Kenil?** Follow `docs/ui-contributions.md`: it decides
whether a change goes to `main` or to the `ui-lab` branch, and for that work it replaces the rules
below on proposing changes to Kenil and on the log.

## The repository

- `core/`: the service (world, engine, gates, scheduler, api, journeys runner); `core/kits/`
  holds Alpha's own modules (Alpha, Network), `core/config/` its prompts, models and limits
- `window/`: the web app the core serves
- `kit-sdk/`: the kit contract; `docs/kit-api.md` is generated from it (`pnpm kit-api`), never
  edited by hand
- `connector-sdk/`, `connectors/<name>/` and `connectors-extra/`: the connectors
- `mac/`: the Tauri Mac shell; `release/` and `scripts/`: the installer, the release and the walls
- `journeys/`: journeys as YAML; their reports go in `docs/journeys/`

Imports go one way (design §3). Internal packages are not built: Node runs their TypeScript
directly, so use erasable syntax only (no enums, no namespaces, no parameter properties).

Node 26 (`.nvmrc`) and pnpm 11. Commands: `pnpm install`, `pnpm check` (typecheck, lint,
test), `pnpm format`, `pnpm start` (builds the window; the core serves it; needs `ALPHA_HOME`),
`pnpm dev:core` with `pnpm dev:window` (Vite on the next port), `pnpm journey <name>`
(`--appended`: Alpha's prompt on Claude Code's own, instead of alone; `--times N`; a client's
with `--from ../<client>/journeys`), `pnpm journeys` (every one), `pnpm kit check|test|pack <dir>`,
`pnpm connector check|pack <dir>`, `pnpm shots`. The core prints the address to open, with
the per-install token. Prompts, models and judgements live in `core/config/`, not in code.

## Rules

- A failure becomes a journey before it becomes a change.
- A rule for the model is a wall in code, or it is not written.
- Nothing is built for a client who has not asked.
- Nothing client-specific in this repository: a client's kits, journeys, data and notes live in
  their own private repository beside it, installed from a folder.
- Every change is proposed to Kenil in writing before it is built, built in the design's shape,
  looked at in the app, and committed after his review. The design changes only on his yes.
- One short dated entry in `docs/log/` per session.
- Read `docs/rules.md` before any change to the core's world, its routes or tools, an agent's
  scripts, a connector's tables or a plugin; a rule goes there the day Kenil says yes to it, with
  the test that holds it (`core/src/rules/`, held to the list by `pnpm rules` in `pnpm check`).
- Read `docs/ui-rules.md` before any change to `window/`; a rule changes there in the same change
  that needs it, by Kenil or a UI contributor (`docs/ui-contributions.md`).
- Tests never call the model or touch a real tenant; journeys run on a fresh tenant each.
- Never `cp` a world file: copy it with SQLite's backup API.
- `../alpha-brain` is v1: read-only reference. Reread what the design names, rewrite it, never
  copy it, never edit it.
- Open sessions on this folder, not on its parent.
