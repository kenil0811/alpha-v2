# Data preparation and analysis

> **Area:** `data-preparation-and-analysis` · owned by the CDO skill. **Use when:** Get messy data from several files or systems into one clean, trusted table and analyse it: profile, clean, join, union, blend, pivot, aggregate, add calculated fields and spatial fields, in Tableau Prep, Tableau or Power Query, then describe and rank what the data shows. Use when someone says "our numbers don't match", "combine these spreadsheets", "every region sends a different format", "how many days does it take us to ship?" or "rank our branches".

**Outcome:** one clean, documented table (or a small star-schema model) that every chart and report draws from, rebuilt the same way each time the data refreshes, plus the first descriptive answers: totals, ratios, ranks, distributions and trends.

## When to use

- Data sits in several files or systems (one per region, one per year, a separate returns log).
- Fields disagree across sources: names, types, date formats, codes versus full names, currency text in numbers.
- A metric needs a field the data lacks (days to ship, returned yes/no, revenue shortfall, traveller type).
- Before any dashboard (`data-visualisation-and-dashboards`), and before handing data to finance or marketing models.

## Method

### 1. Plan the preparation

The stages of data preparation:
1. **Discover:** find the data best suited to the purpose.
2. **Collect** (detain): gather the right data.
3. **Distill:** refine it (clean, combine, shape).
4. **Document:** record business meaning and technical metadata of what was found, collected and refined.
5. **Deliver:** structure it in the form the consuming tool or person needs.

Write down first: the question, the grain you need (one row per order line? per patient visit? per state per year?), and the key fields that link sources (standard practice).

### 2. Profile every source before combining

For each input, look at every field's type, distinct values, nulls and outliers (Tableau Prep's profile pane shows this as bins). Typical findings and their fixes:

| Problem found | Fix |
|---|---|
| Date split into year, month and day fields | Build one date from the parts (MAKEDATE), then remove the parts |
| Number stored as text with a currency code ("USD 125.40") | Remove letters, then change type to decimal |
| "None" or blank where a number belongs | Replace with 0 (only when it truly means zero) and set the type |
| Codes in one source, full names in another (AZ vs Arizona) | Group and replace values (manual mapping) |
| Same person or label typed several ways | Group values by common characters, pronunciation or spelling, then check each group |
| Extra spaces | Trim spaces |
| Two facts in one field (note text plus approver's name) | Split values (automatic or by delimiter), rename the parts, remove the original |
| Duplicate columns (prefixed copies) | Untick them at input |
| Field missing in one source (no Region column) | Add a calculated field with the constant value |
| Out-of-range codes (a rating of 11 on a 1 to 10 scale) | Recode with a rule and note it |
| A numeric ID read as a measure | Convert to dimension |
| A split that mis-parsed one member (a middle initial taken as the surname) | Fix that member with an alias |

Name every cleaning step for what it does ("fix dates and field names"), and review the change list.

### 3. Combine: pick the right operation

| Operation | What it does | Use when |
|---|---|---|
| **Union** | Stacks rows of tables with the same columns | One file per year or per region. Wildcard union pulls every matching file in a folder. After a union, merge mismatched fields (Product vs Product Name) and keep the source-file field if useful. |
| **Inner join** | Keeps only rows matched in both tables | You only want records present in both |
| **Left join** | Keeps all rows of the left table, matches from the right, nulls where none | All orders plus any return data |
| **Right join** | The mirror of a left join | Rarely needed; swap the tables instead |
| **Full outer join** | Keeps everything from both, nulls where unmatched | Reconciliation: find what is in one system and not the other |
| **Blend** | Links two sources at the level of a shared field (state and year) in the view, without merging rows | Sources at different grains (annual GDP vs monthly sales), or sources that can't be joined across databases |
| **Relationship / data model** | Tables stay separate, linked by keys with cardinality | Power BI star schema; Tableau relationships |
| **Pivot** | Turns many columns (1980, 1981, …) into two (year, value) | Wide spreadsheets; rename the new fields to plain names |

Join checks:
- Join on every key that defines a match (order ID **and** product ID); one key alone can multiply or drop rows.
- Read the join summary: rows included and excluded from each side, and the unmatched values. Excluded rows are the first thing to explain.
- Joining tables at different grains duplicates the finer side's values; aggregate first or blend instead.
- After a join, remove the duplicated key fields and rename the kept ones.

Full flow walkthrough: `cdo/references/data-preparation-and-analysis/prep-flows.md`.

### 4. Add the fields the question needs

- **Row-level fields:** days between dates (DATEDIFF), a yes/no flag from a null test (returned if a return reason exists), a combined label (borough plus district), a category from thresholds (traveller type by trips: over 15 extreme, over 10 frequent, over 4 casual, else infrequent), a constant (region).
- **Aggregate fields:** ratios of totals (profit ÷ sales, recycled ÷ refuse tonnage), shortfall against goal shown only where short.
- **Table calculations:** rank, running total, percent of total, difference first to last, window average and standard deviation.
- **Level of detail (LOD) fields:** a value fixed at a chosen level regardless of the view (the hospital's coordinates repeated on every patient row).
- **Spatial fields:** point from latitude and longitude, line between two points, distance, buffer.
- **Groups, sets and hierarchies:** group members into bigger buckets; sets for in/out comparisons; hierarchies for drill-down.

Formula patterns: `cdo/references/data-preparation-and-analysis/calculations-cheatsheet.md`.

### 5. Shape for the consumer

- Aggregate (group by) to the grain the report needs: total units by country and product.
- In Power BI, build a **star schema**: a fact table of numbers to sum (sales, hours, amounts) in the centre, dimension tables (customer, product, date, location) around it, linked by keys with the right cardinality (one customer to many sales). Turn off auto-detected relationships when sources are mixed and set them by hand.
- Output: an extract for the BI tool, a CSV for anyone else, or a published data source on the server. Choose **create** (replace the table each run) or **append** (keep history across runs).
- Save the flow (packaged, with data, when sharing) so the next refresh is one click.

### 6. Describe and analyse

1. Totals and counts by the main dimensions, in a text or highlight table.
2. Ratios that normalise size (recycling rate, profit ratio, revenue per visit); rank units on the ratio, not the total.
3. Distributions: histogram, box plot, mode; filter out units with too little data (minimum games, minimum visits) before ranking.
4. Trends: line by period with a trend line; a forecast for the next periods.
5. Relationships: scatter with trend and R-squared; quadrant split at averages.
6. Concentration: Pareto of the measure by item.
7. Write the finding in one sentence per chart, then check it against the numbers.
8. Before acting on a difference, a trend or a sample result, say how sure it is: a sample result needs its confidence interval, a gap between groups needs a test, and a driver needs a regression with its t-statistic. Method in `analytics-for-decisions`.

## Worked pattern

A small distributor gets order files from four regions: South sends one CSV per year, Central splits dates into three fields and writes "None" for no discount, East puts "USD" in front of sales, West uses state codes and repeats every column with a prefix. Returns sit in a separate sheet whose notes field also carries the approver's name, typed several ways.

1. Inputs: wildcard-union the four South files; untick West's duplicate columns.
2. Clean: Central gets a Region field and two built dates, "None" becomes 0 and the type becomes decimal; East has letters removed from sales; West's 11 state codes are mapped to names.
3. Union all regions: 9,800 rows. Merge "Product" into "Product Name" and "Discounts" into "Discount".
4. Returns: trim spaces, split notes into return note and approver, group approver spellings (7 spellings become 3 people).
5. Join returns to orders on order ID and product ID, left join: all 9,800 orders kept, 640 matched to a return. A join on product ID alone had matched 2,100 rows, which was wrong.
6. Add returned (yes/no) and days to ship. Output an extract, append mode.
7. Analyse: return rate 6.5% overall, 11% in West; median days to ship 4, West 6. Next step: a dashboard on West's shipping and returns.

## Common mistakes

- Combining before profiling, so type clashes and code mismatches surface as nulls later.
- Joining on one key when the match needs two, or joining across grains, so rows multiply.
- Inner join by default, silently dropping orders without returns (or customers without sales).
- Replacing blanks with zero when blank means unknown.
- Fixing data by hand in the source each month instead of building a flow.
- Averaging row-level ratios instead of dividing totals.
- Profiling only the rows that arrived: a survey or extract that is not a random draw carries non-sampling error no cleaning step removes; note who is missing.
- Ranking on totals when units differ in size; ranking units with too little data.
- Leaving duplicated key fields and generic names (Pivot field names, Split 1) in the output.
- No record of what was changed and why (the Document stage).

## Sources
- Method distilled from MBA course material (lectures, notes, textbooks and teaching cases), written in our own words; no course text is reproduced.

## Gaps

- DAX (Power BI measure language) patterns are not covered.
- Segmentation is not covered.
- Data governance (definitions catalogue, access, quality monitoring) is not covered beyond the Document stage.
