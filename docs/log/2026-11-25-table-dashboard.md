# 25 Nov 2026: a table's dashboard row, and the + for a new list

Vikas asked for two things to come back to tables. The first is the dashboard row, about four lines
tall, with charts and buttons standardised. The second is the + after the lists, opening a page like
New module that hands the words to an agent.

- **Dashboard row** (`table/Dashboard.tsx`): sits between the chips and the rows, built from the rows
  the view shows. It has a tile for:
  - Rows
  - up to two choices that hold something
  - up to two sums
  - the first date's week ahead

  Every tile is the same: label, number, a bar chart, and buttons that filter or sort to those rows.
  A right-click hides the row for this person. The core keeps that as `dashboardHidden` in the
  layout, and **⋮ › Dashboard row** brings it back. People's and Tasks' lists have no dashboard row.
- **+ New list** (`table/NewList.tsx`): a page over the rows asks "What list do you want to see?"
  Send gives the Chief of staff a task on the table, asking it to save the list with shape's
  `save_view`, and the page shows that task's work. Picking another list closes the page.
- For Kenil: ui-rules T2 says "no cards of counts above or below a table", and this row reverses it
  on Vikas's word of 25 Nov. Should the rule change?
- TableView went over its wall, so the search box moved to `Toolbar.tsx`.
- Checked in the app on the Deals table. The tiles and their buttons work. Hide lasts after a reload,
  and ⋮ shows the row again. Send made the task, but the agent did not run because the test copy has
  no Claude sign-in.
