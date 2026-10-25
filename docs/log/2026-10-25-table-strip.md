# 25 October 2026: a table's numbers, pages and selected bar

Items 8 and 11 of `proposals/2026-10-25-visual-coherence.md`, stacked on the module-page PR. A
strip of tiles over the table (rows, the first state field's choices, rows holding a value Alpha
guessed), folded away by a chevron at the end of the toolbar. The footer's per-column totals were
already there and now count every row of the view; rows come 50 to a page with "Showing 1–50 of
312", Previous and Next. The ticked bar reads "n selected", Set…, Remove, Cancel; Remove still asks
first in its popover, because `ui/dialog.tsx` is not on this branch. Checked in Edge at 1100×560
and 1240×820, light and dark, by DOM; the page bar was not seen, as no table here has 50 rows.
