# Data visualisation and dashboards

> **Area:** `data-visualisation-and-dashboards` · owned by the CDO skill. **Use when:** Turn a business question and its data into the right chart, a clean dashboard or scorecard with KPI targets, and an interactive data story: choose the chart by purpose, encode and declutter, design filters and actions, and pick the tool (Tableau, Power BI, Excel, Python or R). Use when someone asks "how should I show this?", "build me a dashboard", "is this chart any good?", "which regions missed target?" or "which tool should we use?".

**Outcome:** a decision-maker sees the answer to their question in seconds, can check it, and can explore one level deeper on their own; the chart or dashboard leads to an action, not just a look.

## When to use

- A manager needs a recurring view of how the business is doing (sales, margin, service times, targets).
- An analysis is done and the findings must be shown to an owner, board or client.
- A chart or dashboard exists and needs a critique ("why does nobody use this?").
- Choosing between Tableau, Power BI, Excel, Google Sheets, Python or R for a reporting need.
- For the narrative and slide side of presenting findings, pair with `business-storytelling` (CMO). Marketing funnels belong to the CMO and people analytics to the CHRO; this area supplies the charting method they use.

## Method

### 1. Frame before you draw

Answer three questions first:
1. **Audience:** who will look at it and what decision do they make with it?
2. **Business goal:** descriptive (what happened), predictive (what will happen) or prescriptive (what should we do)?
3. **Data type:** categorical, numerical, geographic, time series or relational (links between things).

Then decide the **purpose** of the visual:
- **Exploratory:** for you, to find the pattern. Many quick charts, rough is fine.
- **Explanatory:** for others, to make one point. Few charts, polished, one message each.
- **Hybrid:** an explanatory front with room to explore (the usual business dashboard).

Separate **information** (what the data contains) from the **message** (what you want the audience to take away and do). A chart without a message is a data dump.

### 2. The end-to-end workflow

Problem statement, then data discovery (what exists, where), data preparation (see `data-preparation-and-analysis`), analysis, visualisation in a BI tool, the data story, and finally the business insight. Skipping the first step is the most common reason dashboards go unused.

### 3. Choose the chart by what you want to show

| You want to show | Use | Avoid |
|---|---|---|
| **Comparison** across a few items | Sorted bar (horizontal when labels are long), lollipop, dumbbell (two points in time), bullet (actual against target), bar-in-bar (actual inside budget) | 3D bars, unsorted bars |
| Comparison over time | Line (many periods), column (few periods), slope graph (two periods, change in rank), bump chart (rank over time), sparkline (many small trends) | Pie per period |
| **Composition**, static | Stacked or 100% bar, treemap, waterfall (how a total builds up), pie or donut only for 2 to 4 parts | Pie with 8 slices |
| Composition, changing over time | Stacked column, stacked area | |
| **Relationship** between two measures | Scatter with a trend line and R-squared, bubble (third measure as size), quadrant chart (split at averages or targets) | Dual axes that imply a link that isn't there |
| **Distribution** | Histogram (choose the bin size deliberately), box-and-whisker, jitter (strip) plot | Average alone |
| **Ranking and focus** | Top N or bottom N bar with a rank column, Pareto (bars sorted descending plus a cumulative % line) | Showing all 2,000 products |
| **Geography** | Filled (choropleth) map for rates by region, symbol (bubble) map for amounts by point, pie-on-map for mix by place, route lines for flows | Filled map of raw totals (big regions dominate) |
| **Survey ratings** | Diverging (Likert) stacked bar centred on neutral | Average rating only |
| **Status against target** | Scorecard grid with check/cross shapes, KPI tile with trend, thermometer or bullet | Gauges that take a lot of space for one number |
| **Plans and schedules** | Gantt with % complete | |
| **Single headline numbers** | KPI cards (big number, comparison, small trend) | |

Full catalogue with build notes: `cdo/references/data-visualisation-and-dashboards/chart-catalogue.md`.

### 4. Encode and declutter

- **Graphical excellence** (Tufte's idea): the most ideas, in the least time, with the least ink, in the smallest space. Delete what does not carry data.
- Position on a common axis is read most accurately; then length; then angle and area; colour intensity least. Put the key comparison on position (standard practice).
- **Sort** bars by value unless the category has a natural order (months, age bands).
- **Colour** with intent: one highlight colour for the point, grey for the rest; a diverging palette only when there is a meaningful midpoint (target, zero, neutral); colour-blind-safe pairs such as blue and orange.
- **Label directly** (values at the end of bars, names at line ends) instead of legends and gridlines.
- Titles state the finding ("South missed the 15% margin target in 5 of 6 months"), not the topic ("Margin by region").
- Format numbers once at the field level (percent, thousands as k) so every view agrees.
- Start bar axes at zero; line axes may zoom in, but say so (standard practice).
- Annotate the one or two marks that matter (the outlier, the mode, the month the trend broke).
- Show uncertainty where the number came from a sample or a model: error bars or a band for the confidence interval, the sample size in the caption, and the break-even or target as a reference line so the viewer sees whether the whole interval clears it (method in `analytics-for-decisions`; the chart form is standard practice).

### 5. Dashboard design

Pick the dashboard **type** to match the job:
- **Guided analysis:** leads the viewer step by step to discover the answer themselves (numbered instructions on the dashboard: pick a department, then a category, then an item).
- **Exploratory:** a tool with filters and parameters to slice the data many ways.
- **Scorecard or status snapshot:** top-level KPIs against target with enough drill-down to find and fix problems and reward success.
- **Narrative:** a story told in sequence (Tableau Stories, a slide deck).

Layout rules:
- Top-left holds the most important number or chart; read order runs left to right, top to bottom (standard practice).
- 3 to 5 views per dashboard; each answers one sub-question of the main question.
- Put filters and parameter controls together, near the views they drive, and say what they apply to.
- Fit views to the space; hide unused legends; one consistent colour meaning across all views.
- Design separate layouts for phone and desktop when people will open it on both.

Interactivity (detail in `cdo/references/data-visualisation-and-dashboards/dashboard-interactivity-and-stories.md`):
- **Filter actions** (click a bar, other views filter), **highlight actions**, **URL actions** (open a map, a web page or a record), **set actions** and **parameter actions** (the click changes a parameter).
- **Parameters** let the viewer swap the measure or dimension shown, set a target, choose top N, or change a histogram bin.
- Decide each filter's **scope**: this sheet only, selected sheets, all sheets on this data source, or all related data sources.
- Use a **context filter** when a top N must be computed inside another filter (top 20 items within the chosen category, not the overall top 20 that happen to be in it).

### 6. KPI scorecards

1. Agree the KPI definition and its formula with the owner (for example profit ratio = total profit ÷ total sales, computed at the level shown, not averaged row by row).
2. Make the target a **parameter** so management can test other cut-offs live.
3. Classify each cell as acceptable or poor against the target; show with shape and colour (both, so it survives colour blindness and greyscale printing).
4. Restrict to a rolling window (last 6 months) that updates with the data, and add an overall total column.
5. Pair the grid with a map or bar of the same KPI so the viewer sees where, not just whether.
6. Add a reference line for the target on any trend chart.

### 7. Tell the story

- A data story needs one main idea, made clear, reached through only the most important information.
- Its objectives are to inform, to give an interface for further exploration, and to prompt an action or decision.
- In Tableau, a **Story** is a sequence of snapshots of dashboards; each point keeps its own filters, parameter values and annotations. Caption each point with the finding, not the chart name.
- Check results after release: **reach** (did the audience see it, who did not), **understanding** (did they read it as intended) and **impact** (did they act). Information can fail technically (the symbols don't arrive), semantically (they don't carry the meaning) or on effectiveness (the meaning doesn't change conduct).

### 8. Choose the tool

| Need | Tool |
|---|---|
| Fast visual exploration, rich custom charts, interactive dashboards and stories, spatial calculations | Tableau Desktop (shared via Tableau Server, Cloud or Public) |
| Microsoft shop, star-schema data model, shared reports in the cloud, cheap seats | Power BI Desktop to build (free), Power BI Service to share |
| Quick analysis and small dashboards, 3D animated maps for a presentation | Excel (pivot tables, Power Query, Power Pivot, 3D Maps) |
| Live market or web data in a shared sheet, simple dashboard | Google Sheets (GOOGLEFINANCE and similar functions) |
| Statistics or models the BI tool lacks, reproducible charts in code | Python or R, alone or called from Tableau |

Detail and trade-offs: `cdo/references/data-visualisation-and-dashboards/tool-choice.md`.

### 9. Using AI in the workflow

Use AI as a collaborator with three checks:
- **Generate:** ask for a calculated field or a first draft chart in Python; paste it in and test whether it runs and gives the right number.
- **Critique:** give the model the chart and the business question; ask for a critique on clarity, labelling and colour, and two specific improvements. Then ask it to critique its own result and improve it (self-critique).
- **Verify:** compare every number and takeaway the model states with the actual figures in the tool before using it. Models invent plausible takeaways.

## Worked pattern

A three-branch clinic chain wants to know where it is missing revenue goals and why.

1. Frame: audience is the operations director; goal is descriptive then prescriptive; data is branch and department revenue against goal, patient waits in minutes, and patient ratings 1 to 10.
2. Scorecard: revenue shortfall = goal minus actual where actual is below goal. Branches: North $4.2m of $5.0m (shortfall $0.8m), East $3.9m of $3.8m (met), South $2.1m of $3.0m (shortfall $0.9m). A donut shows the three branches' revenue plus a fourth slice for the $1.7m total shortfall, with total revenue in the centre; a scorecard grid uses ticks and crosses by department.
3. Why: a bar of average wait by department with a parameter target line at 20 minutes shows South imaging at 34 minutes; a box plot per doctor shows two doctors with wide spreads; a histogram with an adjustable bin shows a long tail past 45 minutes.
4. Experience: three diverging Likert bars (doctor, staff, facility) show facility ratings 40% negative at South.
5. Story: point 1 "South and North missed goal by $1.7m together"; point 2 "South imaging waits are 70% above target"; point 3 "Facility ratings, not doctors, drive South's poor scores". Action: fix South imaging scheduling first.

## Common mistakes

- Starting with the tool and a chart type before the question and the audience.
- Pie or donut with many slices; 3D effects; rainbow colour with no meaning.
- Showing totals on a filled map, so large regions look best; use rates or a symbol map.
- Top N filters that ignore the other filters because no context filter was set.
- A filter that silently applies to only one sheet, so views disagree.
- Averages of ratios (averaging row-level profit ratios) instead of the ratio of totals.
- Forcing a trend line through the origin when the data has no reason to start at zero; reporting a trend without its R-squared.
- Dashboards with 10 views and no stated question; topic titles instead of finding titles.
- Accepting an AI-written interpretation without checking it against the actual numbers.
- Highlighting a gap between bars as a finding when the groups are small or the gap sits inside the margin of error; calling a statistically significant gap important when it is too small to change a decision.

## Sources
- Method distilled from MBA course material (lectures, notes, textbooks and teaching cases), written in our own words; no course text is reproduced.

## Gaps

- Tableau's forecasting method (exponential smoothing settings, prediction intervals) is not covered.
