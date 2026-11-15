# 15 Nov 2026: a fix the person asked for needs no card

Kenil, on a client's agent that repairs a source's reader: "if something is broken and is asked
to be fixed, fix it without additional approval", and "unless something is changing a lot, it
should not ask for a card".

Until now a change to any file a maintained kit shipped went on the maintainer's card from every
door (M4). Now a **data file a script reads** (a reader, a list: `.json`, `.yaml`, `.csv`, `.tsv`,
`.txt` under `skills/` or `files/`), changed in a turn that began with the person's own message,
is kept at once and counted as a change of theirs the maintainer has not seen
(`modules/keep.ts`). "A lot" is held in code as everything else: a script, a schedule, a skill's
words, the notes, a page and a table's shape still go on the card. A turn nobody began (a
schedule that wakes an agent) still asks. Two cases in the M4 rule test hold it; the made-up
maintained kit gained a data file and a script for them.

A journey, `a-kits-agent-adds-a-field`: a kit someone maintains carries an agent; asked for a new
field on its kit's table, the agent's change waits on the maintainer's card, and on "Do it now
anyway" the field is there and the agent fills it. It passes. It answered the question a
client's kit raised: a kit's own agent can add a field to its kit's table.

Found: a journey's `answer` step answers a maintained-shape card only with `on_page: true` (the
card's own route makes the change); and its `field` check compares text, so a number is checked
with `query`.

## Later the same day: a long run does not hold the turn

Kenil asked a kit's agent to run its module's read; the read takes half an hour, and the agent
sat on "Working on it…" until it ended, because the run tool waited for the whole run. Now the
tool waits a short while (config/limits.yaml, `run_wait_seconds`: a moment for a whole schedule,
longer for a script tried with an input, whose outcome the turn needs) and then leaves the run
going by itself, telling the turn it is still running and where its outcome will be
(`engine/tools/waiting.ts`). Two tests: the wait alone, and the tool with a quick script and a
schedule slower than the wait, which still ends ok with nobody waiting.

