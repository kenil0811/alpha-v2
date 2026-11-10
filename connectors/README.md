# Connectors

One package per connector, each built on `@alpha/connector-sdk` and importing nothing else of
Alpha's: `connectors/<name>/` with a `package.json` whose entry exports `connector` (or
`connectors`, several from one helper), its manifest, tools (each declaring its effect, a preview
for the card and its words for Activity), sync, `GUIDE.md`, fixtures and tests. The shape is in
`docs/design.md`.

The core names no connector. At start it loads every package in this folder (the standard set
the release ships), then every folder under Alpha's own `connectors/` beside the kits (the added
set: added with `pnpm connector add <folder or pack>`; the window offers none), each package in a Node process of its own that the core talks to over its pipe
(`core/src/connectors/process.ts`), under the sandbox. A connector awaits each of its host's calls
(`land`, `keys`, `keepFile`, the browser's, `helper`), since the core answers them. Its manifest's
`reaches` names every host it dials; nothing else gets through, and a library that dials out
itself is given `proxy()` from the SDK. A folder that does not load is said on
Home and left out.

`connectors-extra/` holds the ones Alpha has but does not load until added (LinkedIn, whose
manifest carries a warning the person reads first).

- `pnpm connector check <folder>`: what is wrong with a connector before Alpha loads it.
- `pnpm connector pack <folder> [out]`: its folder as one file, with its own packages inside
  (installed with npm, as real folders) and the SDK and zod left out: Alpha links those to its own
  copies when it unpacks, so one of each runs.
- `pnpm connector add <folder or pack>`: adds one to the Alpha on `ALPHA_HOME`. A folder needs
  `developer: true` in that Alpha's `alpha.yaml`; a pack needs Kenil's signature, or the same.
