---
name: Counter
trigger: { every: day, at: "07:00" }
runs: { script: scripts/count/run.js }
touches: [Orders]
---
Counts the orders each morning.
