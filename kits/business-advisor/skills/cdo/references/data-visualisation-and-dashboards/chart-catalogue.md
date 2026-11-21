# Chart catalogue: when to use each chart and how to build it

Depth for `cdo/references/data-visualisation-and-dashboards.md`. Build notes are for Tableau unless stated; the same ideas carry to Power BI, Excel or Python. Field names in examples are illustrative.

## Tables

| Chart | Use when | Build |
|---|---|---|
| Text table (crosstab) | People need to look up exact values | Dimensions on rows and columns, measures on Text. Several measures at once: use Measure Names on columns and Measure Values on Text. |
| Highlight table | A crosstab where the eye should find highs and lows | Text table with the measure also on Color (square marks). Works with hierarchies (category > sub-category, region > state > city) so viewers drill in. |
| Matrix (Power BI) | A pivot-table style summary with row and column totals | Matrix visual; turn row and column totals on or off. |

## Comparison

| Chart | Use when | Build |
|---|---|---|
| Sorted bar | Compare a measure across categories | Dimension on rows, measure on columns, sort descending, label bar ends. |
| Bar with rank column | Show a league table | Add a rank table calculation (rank or unique rank) as a discrete field on rows beside the bar. |
| Grouped bar | Compare two dimensions at once (sales by sub-category and segment) | Both dimensions on rows, colour by the inner one. |
| Lollipop | A cleaner bar for many categories | Dual axis: a thin bar plus a circle (or custom icon) at the end, synchronised axes. |
| Dumbbell (DNA) | Change between two dates per category | Dual axis: a line joining two points (path by year) plus circles; label both ends. |
| Bullet | Actual against target or prior year | Actual as a bar, target as a reference line per cell, optional shaded bands. |
| Bar-in-bar | Actual against budget | Dual axis with the budget as a wide pale bar and actual as a narrow dark bar inside it. |
| Thermometer | Progress toward a goal per unit | A lollipop turned the other way: the goal as the tube, actual as the fill. |
| Butterfly (tornado) | Two groups mirrored on one category list (region A vs region B by sub-category) | Two calculated fields that keep the measure only for each group; one axis reversed. Groups can come from a group, a set or an IN-set test. |
| Animated bar ("bar race") | Show rank changes over time to a live audience | Top N filter, a continuous time field on Pages, labels at bar ends. Use for presentation, not analysis. |

## Over time

| Chart | Use when | Build |
|---|---|---|
| Line | A trend over many equal periods | Continuous date on columns. Add a trend line (linear, with R-squared) or a forecast from the Analytics pane. Line thickness can carry a second measure. |
| Combined bar and line | Two measures on different scales over time (GDP as bars, emissions as lines) | Dual axis, different mark types; label both axes clearly. |
| Sparklines | Many small trends at a glance (top 5 states by month) | One small line per row, axes hidden, a dot on the last value. |
| Slope graph | Change between a start and an end period | Two points per category joined by a line. A helper field takes the last value minus the first; colour by "better, same or worse", remembering that a fall is better for a cost. |
| Bump chart | Rank changing over time | Rank table calculation on rows by period, dual axis line plus circles. |
| Calendar | Daily pattern in one month | Weekday on columns, week number on rows, day as label; a shape for whether a daily ratio met target. |
| Gantt | Projects and schedules | Start date on columns, duration on Size. A helper gives % complete: 1 if ended, 0 if not started, otherwise elapsed time over planned time; a status label from the same tests. |
| Control chart | Is a process in or out of control? | Window average plus or minus k window standard deviations as upper and lower limits (k as a parameter); colour points outside the limits. |

## Composition

| Chart | Use when | Build |
|---|---|---|
| Stacked bar, 100% bar | Parts of a total by category; 100% for mix comparison | Second dimension on Color; for 100% use a percent-of-total table calculation. |
| Pie, donut | 2 to 4 parts of one whole | Donut: dual axis of two pies, the inner one white with the total as its label. Multi-donut: add a dimension to columns. |
| KPI donut | Revenue by unit plus the remaining gap to goal | Add the shortfall (goal minus actual, only where actual is short) as an extra slice; total in the centre. |
| Waterfall | How parts build to a total (shipping cost by region, sales by product) | Running total as a Gantt bar whose size is the negative of the value; show % and amounts; add grand total. |
| Treemap | Many parts with a hierarchy | Size by measure, colour by measure or category. |
| Waffle | A percentage as 100 squares | A 10 by 10 grid helper; fill the squares up to the percentage. |
| Unit chart | Counts as icons (one icon = N orders) | Index-based row and column positions, parameters for units per icon and grid width. |

## Relationship

| Chart | Use when | Build |
|---|---|---|
| Scatter with trend | Do two measures move together (size vs price, sales vs profit)? | Two measures, a dimension on Detail; trend line per group with R-squared annotated. Force through the origin only when zero x must mean zero y. |
| Bubble | Add a third measure | Size by the third measure; Power BI adds a play axis to animate over time. |
| Quadrant | Sort items into four action groups (high sales, low profit…) | Scatter plus reference lines at averages or targets; annotate each area with its meaning. |
| Scatter of flags or maps | Make points recognisable | Use country shapes or custom images as marks. |

## Distribution

| Chart | Use when | Build |
|---|---|---|
| Histogram | Shape of one measure (wait minutes) | Bin the measure; let a parameter set the bin size. Annotate the mode. |
| Box-and-whisker | Compare spread and outliers across groups | From Show Me, or build: points per item plus a box-plot reference distribution; add the mean as a line. Filter out thin data (minimum games, minimum visits). |
| Jitter (strip) | See every item without overlap | A random or index-based offset on one axis, colour by group. |
| Pareto | Which few items make most of the total | Bars sorted descending plus a line of running sum as % of total (dual axis); mark the 80% line. |
| Likert (diverging) | Survey ratings | Recode out-of-range answers first; centre the stacked bars on neutral so negatives go left and positives right. |

## Maps

| Chart | Use when | Build |
|---|---|---|
| Filled map | Rates or KPI status by region | Geographic field, measure on Color. A custom geography can be created from a known one (Region from State). |
| Symbol map | Amounts by city or point | Circle size by measure; add a demographic data layer (median income) for context. |
| Dual-encoded map | Mix by place (pie per country, size by sales) | Dual axis on latitude: filled map plus pie marks. Parameters can swap the measure and the pie's dimension. |
| Routes and distance | Flows, catchment, travel (patients to a hospital, flights) | Spatial calculations: make a point from latitude and longitude, a line between two points, distance in miles, a buffer circle of radius r (parameter). |
| Background map layers | Weather, terrain, satellite | Add a WMS (web map service) server as the map background. |
| Linked web page | Click a point to open a street map or reference page | Dashboard web object plus a URL action that appends the clicked location. |
| Excel 3D Maps | A narrated, animated geographic tour | Bubble, column (clustered or stacked), heat or region maps; time well for a timeline; export the tour as video. |

## Status and headlines

| Chart | Use when | Build |
|---|---|---|
| KPI card | One big number with context | Large value, comparison to target or prior period, small trend. Power BI has a KPI visual with a target well. |
| Scorecard | Many units against one target | Units on rows, periods on columns, a pass/fail field on Shape and Color; overall column from grand totals. |
| Word cloud | Rarely; a quick sense of which labels are biggest | Text marks sized by the measure. Use a bar chart when precision matters. |
