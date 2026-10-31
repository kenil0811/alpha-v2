# Charts: the whole catalogue, and the library to draw them (proposal, 28 Oct 2026)

Vikas asked for every kind of chart, spider charts included, interactive ones too, and for a
library over hand-made ones where one fits. This is the proposal; nothing here is built beyond
what the last column says. The library is Kenil's call.

## The library

Seven charts are hand-made in `window/src/ui/chart.tsx` today. Every new kind by hand is a few
hundred lines, with its own axes, hover and accessibility. A library gives all of them at once.

| Library | Kinds | Interaction | Fits our look | Verdict |
|---|---|---|---|---|
| **Apache ECharts 6.1** (Apache-2.0) | All below, radar, sankey, treemap, sunburst, calendar, parallel, graph, boxplot, gauge, theme river | Hover, click, legend toggles, zoom and pan, brush to select, linked charts, drill-down, keyboard and screen-reader text | Colours are set in JS, so a theme reads our tokens from `app.css` at run time and redraws when the theme changes. SVG or canvas renderer. | **Recommended** |
| Recharts 3.10 (MIT) | Bars, lines, areas, scatter, radar, funnel, treemap, sankey | Hover, click, brush | React and SVG, so our token classes work directly | Second: no calendar heatmap, box plot, parallel or graph |
| Observable Plot 0.6 (ISC) | Strong on dot, beeswarm, small multiples | Hover only | SVG | For static pages, not the window |
| visx 4 (MIT) | Building blocks, not charts | By hand | Full control | As much work as now |
| Vega-Lite 6.5, Chart.js 4.6, Nivo 0.99 | Broad / plain / broad | Varies | Their own look | Not chosen: heavy, plain, or stale (Nivo since May 2025) |

**What ECharts costs.** A new dependency, about 150 KB compressed when only the used kinds are
imported (measured on the build if Kenil says yes), loaded with the Overview, not with Home.
Its look comes from the one theme file, never from a screen. The `look.test` rule (no colour
written out) still holds: the theme reads the tokens.

**What we keep by hand.** Bars, donut, funnel, against target, rings, sparkline and the heatmap
are small and already follow the rules. Moving them to ECharts later is a choice, not a need.

## Every kind, by the question it answers

Have = built today. Lib = comes with ECharts. A kind marked *not offered* breaks a rule in
`ui-rules.md` or the chart guidance (one axis, no rainbow).

### How much, compared
| Kind | Reads as | Status |
|---|---|---|
| Bars, sorted | Which is biggest | Have |
| Grouped bars | Two measures side by side per thing | Lib |
| Stacked bars / 100% stacked | Total and its parts; share of each part | Lib |
| Lollipop, dot plot | Bars with less ink, for many things | Lib |
| Against target (bullet) | Where a figure stands against its goal | Have |
| **Spider (radar)** | One thing's shape across 3–8 measures on the same scale; up to three things laid over each other | Lib |
| Parallel coordinates | Many things across many measures; brush an axis to pick them | Lib |
| Slope | Before and after, per thing | Lib |
| Dumbbell | The gap between two figures per thing | Lib |

Spider charts read badly when the measures have different scales or there are many things laid
over each other. They are offered only with each measure as a share of the team's (or the
firm's) highest, at most three shapes at once, and the figures in the hover.

### Part of a whole
| Kind | Reads as | Status |
|---|---|---|
| Donut | Share, five slices or fewer | Have |
| Treemap | Share in two levels (insurer, then stage), sized by money | Lib |
| Sunburst | The same as rings; click a ring to drill in | Lib |
| Waffle | Share as 100 squares, for people who count | Lib |
| Marimekko | Share across two things at once | Lib |
| Waterfall | How a total is built up or split | Lib |
| Pie of more than five slices | *Not offered* | |

### Over time
| Kind | Reads as | Status |
|---|---|---|
| Sparkline | A figure's recent trend, in a tile | Have |
| Multi-line | Several counts over the weeks, one axis | Have |
| Area / stacked area | A total over time and what it is made of | Lib |
| Theme river (stream) | The mix changing over time | Lib |
| Step line | A figure that changes in jumps (balance in trust) | Lib |
| Bump chart | Rank over time (which insurer is slowest each month) | Lib |
| Calendar heatmap | How much falls on each day of the year | Lib |
| Cumulative / burn-down | Open work going down to zero | Lib |
| Two axes on one chart | *Not offered*: two charts instead | |

### How it is spread
| Kind | Reads as | Status |
|---|---|---|
| Histogram | How many fall in each band (days waiting: 0–7, 8–14…) | Lib |
| Box plot | Middle, spread and outliers, per group | Lib |
| Beeswarm / strip | Every row as a dot along one figure | Lib |
| Violin, ridgeline | The shape of the spread per group | Lib |

### Two figures together
| Kind | Reads as | Status |
|---|---|---|
| Scatter, sized and coloured | Two amounts, a third as size, a state as colour | Have |
| Bubbles on a timeline | When, which lane, how much, what state | Have |
| Connected scatter | Two figures moving together over time | Lib |
| Scatter matrix | Every pair of figures at once | Lib |

### Crossed and flowing
| Kind | Reads as | Status |
|---|---|---|
| Matrix heatmap | Two things crossed, a count each | Have |
| Punch card | The same as dots, for day × hour | Lib |
| Funnel | A sequence where each step loses some | Have |
| **Sankey** | Where things go: from stage to stage, from source to outcome | Lib |
| Chord | Who passes work to whom | Lib |

### Time and schedule
| Kind | Reads as | Status |
|---|---|---|
| Timeline view of a table | Rows on their dates | Have (a table view) |
| Gantt / runway | From one date to another per row, with today | Lib |
| Swimlanes | The same, in lanes per person | Lib |

### Who is connected
| Kind | Reads as | Status |
|---|---|---|
| Tree / org chart | Who reports to whom | Lib |
| Network graph | Clients, insurers, people and how they link | Lib |

### One figure
| Kind | Reads as | Status |
|---|---|---|
| Stat with change and sparkline | One number and its trend | Have |
| Rings | Progress toward several goals | Have |
| Gauge | One figure against its safe range | Lib |

### 3D, as an experiment (Vikas, 25 Oct)
Off by default, on in Settings › Experimental › *3D dashboard*. The chart cards get a
**2D · 3D · Scene** switch, shown only while the experiment is on:
- **2D:** the cards as they are.
- **3D:** each card's chart turned into 3D in place: bars as columns, scatter and bubbles in a
  box, the heatmap as a raised grid. Drag to turn, ⌘-scroll or pinch to zoom, a click opens the
  rows, arrow keys and Enter work.
- **Scene:** every chart card's chart in one shared scene to turn; the cards keep their figure
  and title.

The 2D chart stays the default and the one the hover, the click to rows and the tests are held
to. ECharts' 3D extension (echarts-gl) draws 3D bars, scatter, surface and graph; the other way
is a small projection of our own with no library, as the earlier app did.

### Not offered
Rainbow colours, word clouds, pie of more than five, two axes on one chart.

## What makes them interactive

Each is a behaviour of a chart card, the same everywhere:

| Behaviour | What the person does | Status |
|---|---|---|
| Hover | Sees the row or the figures under the pointer | Have |
| Click to rows | Opens the table filtered to what a mark counts | Have |
| Chart kind | Switches between the kinds that fit, on the card's dropdown | Have |
| Legend toggle | Hides or shows a series | Lib |
| Zoom and pan | Narrows a timeline to a week, drags along it | Lib |
| Brush | Drags across dots or an axis to pick rows; opens them | Lib |
| Linked charts | Picking in one chart highlights the same rows in the module's other charts | Lib |
| Drill-down | Clicks a block (treemap, sunburst) to go a level in | Lib |
| Play over time | Steps a chart week by week | Lib |

## How a chart is picked

As today: from a table's shape, never by its name, and only where it says something. Kinds
that need more than one table's rows (an insurer's overturn rate from Appeals), or a field's
history (time in each stage), need the core to serve them. Those are marked in each client's
own mapping.
