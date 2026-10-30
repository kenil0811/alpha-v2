---
name: Fit
function: Analysis & insights
trigger: { changes: [Deals, Criteria] }
runs: { script: skills/fit/run.js }
touches: [Deals]
---
Works out each deal's loan, its yearly payments and what the SDE leaves after them, then measures
the deal against the criteria's gates and says why.
