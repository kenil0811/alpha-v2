# 16 Nov 2026: Calendar and People as Alpha's own modules, simpler connection cards

Kenil, with his calendar arriving from his Mac: connection cards show too much; Calendar should be
a default module opening on a calendar; contacts should make a People module. His answers to doc
1tgGKnCWGvDRXKHtaSAUWW: always shown, People its own module, details under ⋮; for the calendar
"week/day view as well".

- `core/kits/calendar` and `core/kits/people`, Alpha's own (core: true, managed by Alpha), installed
  at every start: Events (calendar view by Starts until Ends, the default; All events as a table)
  and Contacts, with People and Organizations as People's tabs. Connectors land in them by their
  lasting keys (Contacts now in People). A module of the name that only a connector made is
  adopted by the kit, rows kept and its tables shown (`install(..., { adopt })`); one the person
  made is left alone. Alpha's own modules come first in the rail.
- The calendar view: Month, Week and Day; a week and a day lay timed rows by the hour, as long as
  they last (a view's new `until`), side by side when they overlap, whole-day rows above the hours;
  a date in the month opens its day; with no rows yet, the table's about says where events come
  from.
- A connection's card: its account, state, the computer it runs on, a problem or a refused host
  when there is one, and Read now; Details in its ⋮ shows who set it up, where it is kept and what
  it may reach.
- Looked at in Safari's engine on Kenil's Mac Alpha with four sample events, removed after.
- On Kenil's server the People kit first failed: his contacts were already in a Contacts module a
  connector made ("There is already a table called Contacts"), and the failure stopped the kits
  after it. Now Alpha's own kit takes over such a module under its own name and key (Contacts
  becomes People, its 747 rows kept), and one kit that does not go in no longer stops the others.
