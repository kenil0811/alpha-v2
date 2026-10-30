# 27 Oct 2026: the window on the spine, tried on a firm's executive

Vikas's review of the role prototypes: no pill switch, too many tabs, no spine, Home cut up by
module, descriptions everywhere, Conversation repeated in every module, the toolbar in the wrong
order, every view a table, Open page that does not look like a button, and a row's page that is
the side panel stretched out. Built on `claude/dell-executive` (off `claude/module-overview`),
nothing committed, for Kenil's yes. The firm's modules live in its own private repository.

| Problem | What we build | What it means for the business | Priority |
|---|---|---|---|
| Home is a strip per module; Ask Alpha repeats the assistant | Greeting and date in the bar; Find on top; one strip across all modules (Needs you, Interview me with the top three questions or Start, Agents, Tasks, What changed); then Needs you and What changed | One look says what waits, across the whole firm | High |
| Conversation is a tab of every module | Gone from the module switch; Conversation stays in the rail | Fewer tabs; one place to talk | High |
| Toolbar order and clutter | Search first and wide; Filter on the right beside ⋮; Columns inside ⋮; no "n rows" line under the toolbar; the table hugs its rows so its count sits just above New | Tables read like the agreed toolbar | High |
| No quick way to the usual cuts | Quick filters under the toolbar: a list's tags, else the main choice, with counts; the same rule a Filter makes | One click to Clients, Insurers, My team; to a role; to a stage | High |
| Clients, insurers and the team are not people | `People` gets a Lists column (tags) from the tables whose rows are people: Clients, Insurers, Leads, My team; anyone else is My contacts | Network holds every list; each module keeps its own facts in its own table | High |
| Network and Tasks use a row of tabs | The pill switch in the bar, like a module's | One way around everywhere | Medium |
| Every list opens as a table | A view a module marks default opens first (boards for stages); Tasks open as a board by state; a board card's name opens it | Work in stages reads as stages | Medium |
| Open page looks like a link | A soft accent button at the top of the panel | It is found | Medium |
| A row's page is the side panel stretched | States as coloured words under the title; Details beside what hangs off it; each part a short list; the document under them; relations first | A client reads like a file, not a form | High |
| A list of rows sends you in and out of each one | List view: rows down the left, the picked row's page beside them, like a folder of files; offered again in the view picker; a module may make it default | Work one file after another without leaving the list | High |
| A role's day is spread across tables | A module page made for a role (the firm's Caseload: late, records to chase, visit gaps, updates, benefit late), on the page contract we have | A consultant's morning on one screen | High |
| Charts that say nothing | A chart shows only over 8 or more rows and when its bars differ | Every visual earns its place | Medium |

The row page draws inside the list too (`RowPage inside`). Core change: `world/people/reading.ts` lists the tables each person came from; `api/routes/people.ts`
turns them into Lists. Window: Home, Module, People, Tasks, TableView, Toolbar, Board, RowPage,
RowPanel, Overview, side panel, button. Typecheck and lint pass; tests not run.

## Second review, same day

Vikas walked the prototype as a claim consultant. What broke, and what changed:

| Problem | What we build | What it means for the business | Priority |
|---|---|---|---|
| Tasks' Today, This week… sat in the bar's pill switch, which is for a module's own tables | They are filter buttons under the toolbar, with counts; a For filter (Clients, Insurers…) beside them; Given to agents only when an agent has tasks | The bar means one thing everywhere | High |
| No New on a board, so Tasks could not add one | New under every view, not only the table | Anything listed can be added to | High |
| Save and Cancel appeared at the top, far from New | They sit beside New when the list on screen differs from what was saved | One place for "add" and "keep" | Medium |
| A table's saved lists hid in a dropdown | They are buttons under the toolbar, each with its count; a choice's buttons only where a table has no lists | The usual cuts are one click | High |
| A role page (Caseload) looked like neither a table nor the list view | Gone; the consultant's day is Clients' saved lists (Due now, Records to chase…), with a new filter, *is due by today* | One way to see work everywhere | High |
| Overview said things twice (Interview me, Agents, Alpha changed) and showed noughts | A tile only for what no card says; no 0 counts; no rule bar until a rule exists; no "0 new this week" | Nothing on screen that says nothing | High |
| Home's right column was empty: both lists sat in the left | Needs you on the left; Today and overdue, and What changed, on the right | The day at a glance | Medium |
| A module's name did not say what it is | The rail says a module's description on hover (the core sends it) | No guessing what Team or Claims holds | Medium |
| Files were added two different ways | One drop zone (`ui/drop-zone.tsx`): drop, or click to choose; on a module and on a row's Documents | One way to add a file | Medium |
| Pills ordered by which table points at which put Lawsuits first | The firm's Claims lists them as they escalate; the rule stays for others | Claims reads in order | Low |
| Every chart was two dimensions | Bubbles: when along the bottom, a stage in lanes, an amount as size, a state as colour; on a module's Overview when a table has all four | A caseload's timing, value and risk in one look | Medium |

UI rule proposed: before drawing a control, use the one in `window/src/ui/` that does the job;
make a new one only when none does, and put it there.

### Charts we could offer (for Kenil: which to build)

Built today: bars, donut, funnel, against target, rings, sparkline, bubbles; on 28 Oct scatter,
lines and the matrix heatmap.

| Chart | What it shows | Where it would earn its place |
|---|---|---|
| **Bubbles on a timeline** (built) | when × group × amount × state | Clients by next step; requests by due date |
| **Scatter with size** (built 28 Oct) | two amounts × a third as size × state | Team: overdue items against ongoing claims; Leads: hours to first call against likely benefit |
| **Beeswarm** | one amount's spread, a dot each, by group | Workload points by role |
| **Multi-line** (built 28 Oct) | several series over time, one axis | A table per week of a past date, one line per stage |
| **Small multiples** | one small chart per group, same scale | Each consultant's overdue items by week |
| **Stacked bars** | a whole split into parts, by group | Clients by stage within each insurer |
| **Heatmap (calendar)** | how much falls on each day | Court and appeal deadlines by day |
| **Matrix heatmap** (built 28 Oct) | two choices crossed, a count each | Clients by insurer and stage; Appeals by specialist and stage |
| **Gantt / timeline** | spans of time | An appeal's 180-day window; agreement terms |
| **Slope** | before vs after for each row | Pilot measures, baseline to now |
| **Sankey** | flow from one state to the next | Leads → consult → signed; denial → appeal → upheld → suit |
| **Waterfall** | how a total is built up | A check: client share, fee, referral fee |
| **Histogram** | how often each range happens | Days an insurer takes to answer |
| **Box plot** | spread and outliers by group | Days to close a records request, by provider |
| **Treemap** | a whole by size of its parts | Monthly benefits by insurer |
| **Radar** | one row across several scores | A consultant against the team's average |
| **Stat with sparkline** (built) | one number and its trend | Every module's top tile |

Not offered: dual axes, pie over 5 slices, rainbow colour. 3D only as the *3D dashboard*
experiment Vikas agreed on 25 Oct (2D · 3D · Scene), off by default.

## 28 Oct: scatter, lines, heatmap

Vikas picked these three from the list. Each is drawn on a module's Overview only when a table's
own fields support it, never named:

- **Scatter:** two amounts that vary and are mostly not zero, a third as size, a toned choice as
  colour, five rows or more. Skipped when the two move together (a fee that is a share of the
  amount), since that line says nothing.
- **Lines:** counts per week along a mostly-past date, one line per value of the main choice. Only
  the four biggest get colour (four new series tokens in `app.css`, checked for colour-blindness in
  both themes); the rest are one grey Other. Each line's name sits at its end. Lines are never
  drawn on the date the bubbles use, and need four weeks or more.
- **Heatmap:** what the rows point at (an insurer, a person), or a second choice, crossed with the
  main choice. The accent is darker for more, and each cell opens its rows.

Axes step in round numbers (`ticksOf`, with its test). For Kenil: the four series colours are new
tokens; until now the look has been one accent.

**Later on 28 Oct:** the whole chart catalogue, with spider charts and the interactive behaviours,
is now `docs/charts.md`. It proposes Apache ECharts as the one chart library (Kenil's call). The
client's mapping of every data point to a chart is in their own repository.
