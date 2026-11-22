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

A journey's `plugins:` names the plugins its Alpha has switched on, as that Alpha's `alpha.yaml`
does (`plugins: [interviews]`); with none named, none loads, and one named that is not in
`plugins/` fails the journey before its first step. A `plugin` step presses a button on a
plugin's screen, or reads the screen, through the plugin's own routes. An `interview` step
answers an agent's cards one at a time as they come, each by the first of its answers whose
pattern fits the card: a choice or the person's own words, and on a card of lines (About you)
the first so many dropped and the rest kept; `until` stops at a card and leaves it waiting.
The stand-in computer of a `bridge` step lends its Calendar, Contacts or browsing history on
recorded answers, and `due: { days: 31 }` is the scheduler's tick that many days on.

Set up Alpha, the onboarding story, is pressed through its own routes (`/api/story`, the
contract in `core/src/journeys/story-steps.ts`). A `story` step does a chapter's act with what the
person gives it (`body`), its Skip (`skip`, with `refused: true` where the story must refuse it),
every chapter before one skipped (`skip_to`), or What I learned answered question by question,
About you's first so many lines dropped and each playback taken by the first answer whose pattern
fits. `as: <name>` takes the step as a member the owner added with a `member` step. `claude:
unset` starts the Alpha with no way to Claude until its Claude chapter is given the runner's own
token as `{claude}`, which no report shows. The `story` check reads where a person's story
stands (its chapters, where it is, done, Home's row), `story_says` what a chapter's screen says
and never says, and `needs_you` how many cards wait on the person.
