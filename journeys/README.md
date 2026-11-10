# Journeys

One YAML file per journey: steps (say, answer a card, give a folder, connect an account on
recorded answers, serve a made-up site that later steps say as `{site}`) and checks on the world, run on a fresh tenant of its own with the real model. Reports go in
`docs/journeys/`, which keeps each round's summary and the latest report of each journey; older
reports are in git history. `docs/design.md` says what they are for. `pnpm journey <name>` runs one
(`--times N` runs it N times, each on a fresh world), `pnpm journeys` runs them all, and a
client's run from its own repository with `--from ../<client>/journeys`.

The person's own steps in the window go through its routes: `edit` (a value typed over a row's),
`remove` and `reset`, each naming a row by its name or its own key. A `site` named again with a
`state` serves the pages in its `states/<state>/` folder at the same address. A check with
`waits: <what>` waits on what it names, as a rule in `docs/rules.md` does (Dell's contract): its
report says "waits", and the day it holds it fails with "holds now: take off waits". A journey whose every check
waits is not run.
