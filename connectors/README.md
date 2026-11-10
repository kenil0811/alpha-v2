# Connectors

One package per connector, each built on `@alpha/connector-sdk` and importing nothing else of
Alpha's: `connectors/<name>/` with a `package.json` whose entry exports `connector` (or
`connectors`, several from one helper), its manifest, tools (each declaring its effect, a preview
for the card and its words for Activity), sync, `GUIDE.md`, fixtures and tests. The shape is in
`docs/design.md`.

The core names no connector. At start it loads every package in this folder (the standard set
the release ships), then every folder under Alpha's own `connectors/` beside the kits (the added
set: what the person added in Intelligence › Connections from a folder or an `.alphaconnector`
file), each package in a Node process of its own that the core talks to over its pipe
(`core/src/connectors/process.ts`), under the sandbox. A connector awaits each of its host's calls
(`land`, `keys`, `keepFile`, the browser's, `helper`), since the core answers them. Its manifest's
`reaches` names every host it dials; nothing else gets through, and a library that dials out
itself is given `proxy()` from the SDK. A folder that does not load is said on
Home and left out.

`connectors-extra/` holds the ones that come with Alpha but load only once added (LinkedIn,
whose manifest carries a warning the person reads first): the release packs each into a file
offered in Intelligence › Connections. Once added, one is updated at start to the newest pack a
release brought, as Alpha's own kits are; bump its `version` when it changes.

- `pnpm connector check <folder>`: what is wrong with a connector before Alpha loads it.
- `pnpm connector pack <folder> [out]`: its folder as one file, with its own packages inside
  (installed with npm, as real folders) and the SDK and zod left out: Alpha links those to its own
  copies when it unpacks, so one of each runs.
