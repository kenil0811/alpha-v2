# Calculated fields: patterns for business questions

Depth for `cdo/references/data-preparation-and-analysis.md`. Tableau syntax; field names are illustrative. Excel and Power BI have direct equivalents (standard practice).

## Row-level

| Need | Pattern |
|---|---|
| Sum of parts | `[Paper tons] + [Plastic tons]` |
| Days between dates | `DATEDIFF('day', [Order date], [Ship date])` |
| Date from parts | `MAKEDATE([Year], [Month], [Day])` |
| Yes/no flag from a missing value | `IF ISNULL([Return reason]) THEN "No" ELSE "Yes" END` |
| Bands from thresholds | `IF [Visits] > 20 THEN "Loyal" ELSEIF [Visits] > 8 THEN "Regular" ELSEIF [Visits] > 2 THEN "Occasional" ELSE "New" END` (test the highest band first) |
| Two-way flag | `IIF([Segment] = "Retail" OR [Segment] = "Online", "Direct", "Other")` |
| Code a category as a number (for sort order) | `CASE [Category] WHEN "Food" THEN 1 WHEN "Drink" THEN 2 ELSE 3 END` |
| Combined label | `[City] + ", " + [State]` (wrap numbers in `STR()`) |
| Recode an out-of-range answer | `IIF([Rating] > 10, 10, [Rating])` |
| Constant to fill a missing column | `"Central"` |
| Keep a measure only for one group (butterfly halves) | `IF [Region] = "North" THEN [Sales] END` |
| Project % complete | 1 if end date passed, 0 if start in the future, else elapsed time ÷ planned duration |

## Aggregate (ratio of totals)

| Need | Pattern |
|---|---|
| Profit ratio | `SUM([Profit]) / SUM([Sales])` |
| Pass/fail against a target parameter | `IF [Profit ratio] >= [Target] THEN "Acceptable" ELSE "Poor" END` |
| Shortfall only where short | `IF SUM([Goal]) > SUM([Actual]) THEN SUM([Goal]) - SUM([Actual]) END` |
| Share of a subgroup | `SUM(IF [Region] = "East" THEN [Sales] END) / SUM([Sales])` |

## Parameter-driven

| Need | Pattern |
|---|---|
| Selected measure | `CASE [Choose measure] WHEN "Sales" THEN [Sales] WHEN "Profit" THEN [Profit] ELSE [Quantity] END` |
| Selected dimension | the same with dimensions |
| Spatial buffer of radius r | `BUFFER(MAKEPOINT([Lat], [Lon]), [Radius], 'mi')` |

## Table calculations (computed over the marks in the view)

| Need | Pattern |
|---|---|
| Rank | `RANK(SUM([Sales]))`; `RANK_UNIQUE` breaks ties |
| Running total, % of total | quick table calculations, or `RUNNING_SUM(SUM([Cost])) / TOTAL(SUM([Cost]))` for a Pareto line |
| Total across the view | `WINDOW_SUM(SUM([Sales]))` |
| Change first to last | `LOOKUP(SUM([Sales]), LAST()) - LOOKUP(SUM([Sales]), FIRST())` |
| Control limits | `WINDOW_AVG(AVG([Wait])) ± [k] * WINDOW_STDEV(AVG([Wait]))`; flag points outside |
| Grid positions for unit or waffle charts | built from `INDEX()` with integer division and remainder |

Set "compute using" deliberately (across, down, by a named field); a wrong direction gives a plausible but wrong number.

## Level of detail (LOD)

| Need | Pattern |
|---|---|
| A value fixed at a chosen level, repeated on every row | `{FIXED : MIN(IF [Type] = "Hospital" THEN [Lat] END)}` gives the hospital's latitude on each patient row |
| Customer-level value regardless of view | `{FIXED [Customer] : SUM([Sales])}` (standard practice) |

## Spatial

| Need | Pattern |
|---|---|
| Point | `MAKEPOINT([Lat], [Lon])` |
| Line between two points (routes, catchment) | `MAKELINE(MAKEPOINT(...), MAKEPOINT(...))` |
| Distance | `DISTANCE(point1, point2, 'mi')` |
| Circle around a point | `BUFFER(point, radius, 'mi')` |

## Script functions (Tableau with R or Python)

`SCRIPT_REAL`, `SCRIPT_INT`, `SCRIPT_STR`, `SCRIPT_BOOL` send aggregated arguments (`_arg1`, `_arg2`) to the R or Python server and return the result per mark; for example a correlation between total sales and total profit computed with numpy.

## Excel and Power BI equivalents (standard practice)

| Tableau | Excel | Power BI |
|---|---|---|
| DATEDIFF | `=Ship-Order` or `DATEDIF` | `DATEDIFF` in DAX, or a Power Query duration |
| IF / CASE | `IF`, `IFS`, `SWITCH` | `IF`, `SWITCH` |
| Ratio of totals | `SUM()/SUM()` in a pivot calculated field | a measure `DIVIDE(SUM(...), SUM(...))` |
| RANK | `RANK.EQ` | `RANKX` |
| FIXED LOD | `SUMIFS` | `CALCULATE` with `ALLEXCEPT` |
