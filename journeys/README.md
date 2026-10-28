# Journeys

One YAML file per journey: steps (say, answer a card, give a folder, connect an account on
recorded answers, serve a made-up site that later steps say as `{site}`) and checks on the world, run on a fresh tenant of its own with the real model. Reports go in
`docs/journeys/`. The shape is in `docs/design.md` §16. `pnpm journey <name>` runs one
(`--times N` runs it N times, each on a fresh world), `pnpm journeys` runs them all, and a
client's run from its own repository with `--from ../<client>/journeys`.
