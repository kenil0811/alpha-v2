# 3 Nov 2026: Calendar gathers every date, Documents, the thesis fit, OpenStreetMap

For Avilo's demo, on autopilot (no review, Vikas 2 Nov).

- Calendar gathers open tasks with a due date and every row's dates (`/api/dates`); its own
  events stay as they were.
- Knowledge Base is Documents (`core/kits/documents`); an install that has Knowledge Base keeps it
  and its name (`FORMERLY` in `modules/defaults.ts`). Alpha's own modules install before the
  inbox, so they sit atop the rail.
- A page says the row it is for (`<meta name="alpha-for">`); it leaves the tabs and opens from
  that row's record with the row as its input (`?inputs=` on the page route).
- Network's Map is OpenStreetMap tiles; places are found with Nominatim, one a second, the names
  only, kept in the tenant's `places.json`.
- Overview: the thesis-fit tile and the scatter's box, a card per figure for a small table, Files
  as icons, the switch centred. New module: no table, an upload under the prompt.
- Avilo: Acquisition Lab dropped as a module; its reviews on Deals (source Acquisition Lab), its
  sessions on the Calendar, its guides and templates in Documents, its people in Network.
  Accounting has figures and export files; DealPilot is Overview, Deals and Sources.
- The pages PDF test still needs Playwright, failing on main too.
