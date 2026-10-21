---
name: LinkedIn export
trigger: { filed: true }
runs: { script: skills/linkedin/run.js }
touches: [LinkedIn]
---
Reads LinkedIn's own export of the person's connections (Connections.csv, from LinkedIn's
Settings › Data privacy › Get a copy of your data), when they drop it in, into LinkedIn: each
connection with their profile link, company, position and when they connected. Every connection
is then one of the person's people.
