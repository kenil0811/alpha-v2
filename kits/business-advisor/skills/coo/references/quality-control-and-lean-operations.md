# Quality control and lean operations

> **Area:** `quality-control-and-lean-operations` · owned by the COO skill. **Use when:** Keep a process stable and defect-free with control charts, process capability, stop-and-fix rules and Six Sigma problem solving, and organize work as a lean pull system with low inventory and self-balancing teams. Use when defects, rework or returns rise, when output quality varies, or when work piles up between steps.

**Outcome:** defects caught at the source rather than by customers, a simple chart that tells managers when a process has really changed, and a flow with less work-in-process, shorter lead times and fewer hidden problems.

## When to use
- Rework, returns, complaints or scrap are rising.
- Output varies and managers react to every bad day.
- Inventory piles up between steps; lead times are long.
- Choosing between one-person-does-all (craft) and line (assembly) work design.

## Method

### 1. Why quality is an operations lever
- Rework consumes capacity, often at the bottleneck; fixing quality is one of the cheapest ways to add capacity.
- Large inventories delay discovery of defects and enlarge exposure when one is found (Little's law: more stock, older stock). Less WIP surfaces problems faster.
- Inventories between stages hide problems and weaken teamwork; just-in-time removes them deliberately.

### 2. Build quality in: jidoka
- Any worker can stop the line (or flag the job) when an abnormality appears; fix the cause before resuming.
- Mistake-proof steps (poka-yoke): fixtures, checklists, forms that refuse invalid input.
- Inspect at the source, not only at the end.

### 3. Control charts
- Separate common-cause variation (normal noise) from special causes (something changed).
- Measurements: take small samples (n = 4 or 5) regularly. Plot sample means (x-bar chart) and ranges (R chart).
  - Center line = grand mean x̄̄; limits = x̄̄ ± A2 x R̄ (A2 = 0.729 for n = 4, 0.577 for n = 5).
  - R chart: upper limit D4 x R̄ (D4 = 2.282 for n = 4, 2.114 for n = 5), lower D3 x R̄ (0 for n <= 6).
- Defect rates: p chart, p̄ ± 3√(p̄(1 − p̄)/n). Defect counts per unit: c chart, c̄ ± 3√c̄.
- React to: a point outside limits; runs of 7+ on one side of the center; clear trends. Otherwise leave the process alone; adjusting for noise adds variation.
- Set limits from a stable period; limits describe the process, not the customer's spec.

### 4. Process capability
- Cp = (USL − LSL) / 6σ; Cpk = min(USL − μ, μ − LSL) / 3σ. Below 1.0 the process will make defects even when in control; 1.33+ is a common target.
- Six Sigma aims for a spread so narrow that specs sit about six standard deviations from the mean (about 3.4 defects per million with the usual 1.5σ drift allowance).

### 5. Solve problems with DMAIC
- Define the problem and customer requirement; Measure the current defect rate; Analyze root causes (Pareto chart: the few causes behind most defects; fishbone; 5 whys); Improve with tested changes; Control with charts and standard work.

### 6. Lean flow and pull
- Pull: a step produces only when the next step signals need (kanban cards, empty bins, WIP caps per step). Caps WIP, so by Little's law caps lead time.
- Small batches and fast changeovers (setup reduction) make small batches economical.
- Level the schedule (mix and volume) so suppliers and steps see steady demand.
- Standard work and continuous improvement by the people doing the work.

### 7. Work design: craft, line and bucket brigades
- Craft (one worker, whole job): flexible, motivating, needs broad skill. Line: specialized and fast, but needs balancing and is blocked by its slowest step (see process-capacity-and-cycle-time).
- Bucket brigade: workers ordered slowest to fastest along the line; each works forward until the next worker takes over the job, then walks back and takes over from the previous worker. The line balances itself without engineering studies.

## Worked pattern
A print shop checks 50 orders a day for errors. Over 20 days the error rate averaged 4% (p̄ = 0.04).
- p-chart limits: 0.04 ± 3√(0.04 x 0.96 / 50) = 0.04 ± 0.083, so upper limit about 12%, lower 0.
- A day at 8% is noise: don't retrain anyone. A day at 14%, or seven days in a row above 4%, signals a change: look for the cause (new paper stock, new operator).
- Pareto of last month's errors: 60% are wrong file versions. Mistake-proof upload (version check) before adding inspectors.

## Common mistakes
- Treating every bad day as a special cause and tinkering.
- Using customer spec limits as control limits.
- Inspecting quality in at the end instead of building it in.
- Cutting inventory without fixing the problems it was hiding (lines stop constantly).
- Large batches "for efficiency" that lengthen lead times and hide defects.

## Sources
- Method distilled from MBA course material (lectures, notes, textbooks and teaching cases), written in our own words; no course text is reproduced.

## Gaps
- None noted beyond the scope above.
