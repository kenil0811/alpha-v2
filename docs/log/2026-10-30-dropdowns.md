# 30 October 2026: dropdowns open on a double-click, search past six

Taken from the 27–30 Oct review, the dropdown part alone; proposed to Kenil as its own PR.

- A choice cell is the one dropdown now, not the browser's `<select>`: a double-click opens its
  list at once, a pick saves, a click away or Escape leaves it. Add new… at its foot (T10, T11).
- The search line shows past six options, not five, in every dropdown and in the tags picker.
- Tags have Add new… and the search too; Add new… is one `AddNew` in `ui/field.tsx`, not a form,
  so it can sit inside Add a row and a form view. Set many rows' value has Add new… as well.
- Waits on the core: the ★ to keep an option at the top of a list, per person. It needs the
  layout's per-person pins, which are not on main; until then no ★ on choices.
