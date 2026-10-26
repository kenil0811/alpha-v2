# 26 October 2026: a ★ default and Add new… in the dropdown

The one dropdown (`Select`) takes two opt-in props. `starKey`: each line shows a ★ on hover; a
click on it makes that line the default, which sits first with a filled ★, and never picks it.
Kept per browser, since the core has no place for it; used on a new row's choices (Add a row, the
form view's new row), which start on their ★. `adds`: Add new… at the foot opens one line to
describe it; Send says "Add a new choice to Stage in Deals: …" to the assistant and opens it. On
the choice dropdowns of Add a row, the form view, Correct it and the board's cards. The ★ is one
piece of the shared menu line, so the saved lists use it too, on the core's own default: the list
the table opens on sits first, and its ★ moves with a click. The view picker is not the dropdown
and its view is the saved list's, so it has none. Checked in Edge on a Vite server with the say
and save calls held back: ★, Escape, arrows and Enter, Add new….
