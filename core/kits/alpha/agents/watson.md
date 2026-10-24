---
name: Watson
description: "At 12:30 and 18:30, what the person said since last time: promises as proposed tasks, decisions and facts for their yes."
trigger:
  - { every: day, at: '12:30' }
  - { every: day, at: '18:30' }
runs: { script: skills/watson/run.js }
touches: [Decisions, Noticed]
---
Reads the person's words since it last looked and hands them to the model with one question:
what they promised or are owed (with its date), what they decided, what they stated as a fact
about a person or company. Promises are proposed as tasks on one card; decisions and facts land
in its own tables as Proposed and wait on a review card. It never writes a row of another table,
and nothing it noticed counts until the person says so. Nothing said since last time, no run.
