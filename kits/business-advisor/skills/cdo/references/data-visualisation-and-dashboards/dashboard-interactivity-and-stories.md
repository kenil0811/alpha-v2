# Dashboard interactivity, KPI scorecards and data stories

Depth for `cdo/references/data-visualisation-and-dashboards.md`. Tableau terms; Power BI equivalents at the end.

## Parameters: let the viewer choose

A parameter is a single value the viewer sets (a number, a date, a string from a list). On its own it does nothing; a calculated field or a filter must read it.

| Pattern | How |
|---|---|
| Swap the measure | A list parameter (Sales, Profit, Quantity, Cost) and a "selected measure" field that returns the matching measure with a CASE test. Use the selected measure in every view so one control changes the whole dashboard. |
| Swap the dimension | The same idea for Category, Region, Segment, Ship mode. |
| Target or threshold | A number parameter used in a pass/fail field and as a reference line. |
| Top N | An integer parameter used in a Top filter. |
| Bin size | A parameter that sets histogram bin width. |
| Control limit width | k in average ± k standard deviations. |
| Radius | Buffer distance around a point on a map. |
| "Button" sheet | A small sheet listing the parameter's values; a parameter action sets the value on click, which looks like a button. |

Show each parameter control on the dashboard, labelled in plain words.

## Filters and their scope

Order of operations matters (standard Tableau behaviour): context filters run first, then top N and dimension filters, then measure filters, then table calculation filters.

Scope options on any filter:
1. Only this worksheet.
2. Selected worksheets.
3. All worksheets using this data source.
4. All worksheets using related data sources (fields related across sources).

Rules:
- A dashboard-wide control (department, year) should apply to all sheets on the data source.
- A top N that must respect another filter needs that filter added to **context**.
- A rolling window ("last 6 months") is a top N on the date field, so it moves as data arrives.
- A measure filter on a dimension (players with at least 100 at-bats) removes thin data before ranking.

## Dashboard actions

| Action | What the click does | Typical use |
|---|---|---|
| Filter | Filters target views to the clicked mark | Click a category bar; the map and trend show only that category. |
| Highlight | Highlights matching marks elsewhere | Keep context while showing where an item sits. |
| URL | Opens a web page (in a browser or a web object on the dashboard) | Street map of the clicked city, a reference page, the CRM record. |
| Set | Adds the clicked marks to a set | Compare the selected group against the rest; drive butterfly charts. |
| Parameter | Sets a parameter to the clicked value | Buttons, drill-down by changing the dimension. |
| Change parameter | Same as above, named this way in recent versions | |

Settings to decide for each action: source sheets, target sheets, run on select, hover or menu, and what happens when the selection is cleared (show all values or exclude all). Name each action.

"Use as filter" on a view creates a filter action for the whole dashboard in one click.

## Guided analysis dashboard (pattern)

Question: are the least profitable items always unprofitable?
1. Bar: profit by category, sorted, with a department filter shown.
2. Bar: the 20 least profitable items (bottom N by profit).
3. Filled map: profit by state.
4. Line: profit by quarter with a linear trend line.
5. Dashboard: a text box with numbered instructions (choose a department, then a category, then an item); the category bar used as a filter; a filter action from the item bar to the map and trend; department and category in context for the bottom-20 view.

## KPI scorecard (pattern)

1. Ratio field: sum of profit divided by sum of sales.
2. Target parameter (float, shown as a percent, default 15%).
3. Status field: acceptable if ratio ≥ target, else poor.
4. Grid: region on rows, month on columns, status on Shape and Color (ticks and crosses, blue and orange), last 6 months, an "Overall" grand total column in bold on light grey.
5. Companion map: region as a custom geography built from state, ratio on Color and Label.
6. Dashboard: grid, map, target control, a one-line explanation.

## Stories

- A story is a sequence of story points; each holds a snapshot of one dashboard or sheet with its own filter, parameter and selection state and its own annotations.
- Buttons: new blank point, duplicate (copy the current point and change one thing), save as new point; after interacting, update the point or revert it.
- Caption each point with its finding. Typical arc: the problem ("the South has missed target for six months"), the evidence ("only one state met 15%"), the what-if ("at 10%, three states would pass"), the nuance ("some states did well historically"), the ask.
- Annotate the mark the caption is about.

## Healthcare-style operations dashboard (pattern)

Two dashboards and a story:
- Experience: three Likert charts (doctor, staff, facility ratings), after recoding out-of-range answers.
- Service: wait time by branch and department with a target parameter as a reference line; a histogram with an adjustable bin; box plots per doctor and per department with the same target line.
- Revenue: highlight table of revenue, goal and shortfall by branch and department; KPI donut; scorecard of goal met; thermometer per branch.

## Power BI equivalents

| Tableau | Power BI |
|---|---|
| Filter and highlight actions | Built-in cross-filtering; set each visual's interaction to filter, highlight or none (Edit interactions) |
| Hierarchy drill | Put the hierarchy levels in the axis well; drill icons on the visual |
| Dashboard filter | Slicer visual; filters at visual, page or report level |
| Reference line | Analytics pane (average, constant and similar lines) |
| KPI | KPI visual with indicator, trend axis and target goal |
| Animated scatter | Play axis on the scatter or bubble chart |
| Story | Report pages, bookmarks (standard practice) |
