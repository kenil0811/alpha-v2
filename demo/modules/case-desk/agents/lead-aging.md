---
name: Lead aging
function: Admin
trigger: { every: hour }
runs: { script: skills/lead-aging/run.js }
touches: []
---
Says which new leads have waited over two days for a first contact.
