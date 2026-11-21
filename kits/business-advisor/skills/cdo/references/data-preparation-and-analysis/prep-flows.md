# Building a preparation flow (Tableau Prep, Power Query)

Depth for `cdo/references/data-preparation-and-analysis.md`.

## Tableau Prep Builder: the flow, step by step

1. **Connect.** Add each source (text file, Excel, database, extract). In the input step, review fields, types and sample values. Untick fields you will not need (duplicate prefixed columns).
2. **Wildcard union at input.** When a source comes as one file per period, use the multiple-files option with a name pattern so every matching file in the folder lands in one input step, and new files are picked up next run. A file-path field records where each row came from.
3. **Note issues you can't fix at input** (split dates, wrong types, missing columns) and fix them in a clean step.
4. **Clean step per source.** The workspace shows the flow, the profile pane (each field binned, nulls and outliers visible) and the data grid. Use the toolbar search to find fields. Operations:
   - create calculated field (same language as Tableau Desktop)
   - remove, rename, change type
   - edit a value (double-click), edit several values
   - group values: manual mapping, or automatic by pronunciation, common characters or spelling
   - clean: trim spaces, remove letters, remove punctuation, change case
   - split values: automatic or custom delimiter
   - filter rows
   Name the step; the changes list lets you edit, delete or reorder changes.
5. **Union** the cleaned steps (drag one onto another, drop on Union, add the rest). Same-named, same-typed fields match automatically. Show only mismatched fields; merge pairs that hold the same data under different names; Prep may suggest matches.
6. **Join** another source (drag onto the union, drop on Join). In the join profile:
   - set every join clause the match needs (add recommended clauses)
   - click the join-type diagram to try inner, left, right, full and see included and excluded rows per side
   - read the unmatched values per clause
7. **Clean the join result.** Remove duplicated key fields (suffix -1) and helper fields (table names, file paths); rename what is kept; add flags and durations.
8. **Preview** at any step in Tableau Desktop to test; changes there don't write back.
9. **Aggregate or pivot steps** when the output grain differs from the input (standard practice).
10. **Output.** To a file (extract .hyper for Tableau, CSV for others) or a published data source. Write option: create table (replace) or append table (keep history). Run the flow; save it as a flow (.tfl) or packaged flow with data (.tflx).

## Power Query (Power BI and Excel)

1. Get data, pick the source, select tables in the navigator, choose transform (edit) rather than load when shaping is needed.
2. Applied steps are recorded automatically (promoted headers, changed type); each later step adds to the list and can be removed or edited.
3. Common transforms: remove duplicates, replace values (make country codes consistent), remove errors, change types, split column by delimiter or number of characters, use first row as headers, add or remove rows and columns, add custom columns (a goal as a formula), group by (sum units by country and product).
4. Use a reference query to branch a second shaped table off the first without duplicating its steps.
5. Close and apply loads the tables into the model.
6. In the model view, create or edit relationships: keys, cardinality (one-to-many, one-to-one, many-to-one) and cross-filter direction. Turn off auto-detect when sources are mixed.

## Inside Tableau Desktop (no separate prep tool)

- Data source page: drag a second table next to the first to join; choose join type and clauses; drag New Union for row stacking.
- Pivot: select the wide columns in the preview, right-click, pivot; rename the two new fields.
- Split a text field from its menu (transform, split or custom split).
- Blend: add a second data source, make sure the linking fields share a name (or edit relationships); the primary source's view pulls aggregated values from the secondary.
- Convert numeric IDs to dimensions; set default number formats and aliases at the field level.

## Checklist before handing data over

- Row count after each step matches expectation, and excluded rows are explained.
- Every key field is unique where it should be.
- Types are right (dates as dates, money as decimal).
- No generic names left (Split 1, Pivot field values).
- A short note of each change and why (the Document stage).
- The flow runs end to end from the raw files with one click.
