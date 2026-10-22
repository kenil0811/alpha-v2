# Connectors

One package per connector, each built on `@alpha/connector-sdk` and importing nothing else of
Alpha's: `connectors/<name>/` with a `package.json` whose entry exports `connector` (or
`connectors`, several from one helper), its manifest, tools (each declaring its effect, a preview
for the card and its words for Activity), sync, `GUIDE.md`, fixtures and tests. The shape is in
`docs/design.md` §8.

The core names no connector. At start it loads every package in this folder (the standard set
the release ships), then every folder under Alpha's own `connectors/` beside the kits (the added
set: what the person added in Settings › Connections from a folder or an `.alphaconnector`
file). A folder that does not load is said on Home and left out.

`connectors-extra/` holds the ones that come with Alpha but load only once added (LinkedIn,
whose manifest carries a warning the person reads first): the release packs each into a file
offered in Settings.

- `pnpm connector check <folder>`: what is wrong with a connector before Alpha loads it.
- `pnpm connector pack <folder> [out]`: its folder as one file, with its own packages inside
  (installed with npm, as real folders) and the SDK and zod left out: Alpha links those to its own
  copies when it unpacks, so one of each runs.
