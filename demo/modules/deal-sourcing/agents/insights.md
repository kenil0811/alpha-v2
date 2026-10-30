---
name: Insights
function: Analysis & insights
trigger: [{ changes: [Deals] }, { every: day, at: '07:30' }]
runs: { script: skills/insights/run.js }
touches: []
---
Reads the deals and says on the Overview what stands out: this week's new deals and where they
are, how many fit, deals left unreviewed, and what the ones that fit ask.
