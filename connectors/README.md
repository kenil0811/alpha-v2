# Connectors

One package per connector, each built on `@alpha/connector-sdk` and importing nothing else of
Alpha's: `connectors/<name>/` with its manifest, reads, actions (each declaring its effect),
events, sync, `GUIDE.md`, fixtures and tests. The shape is in `docs/design.md` §8. The first
ones come in week 2.
