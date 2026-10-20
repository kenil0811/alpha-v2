---
name: Counter
trigger: { every: day, at: "07:00" }
runs: { script: skills/count/run.js }
touches: [Orders]
---
Counts the orders each morning.
