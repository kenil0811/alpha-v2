# 3 Nov 2026: a row opens on a click, Network's map, one card per question

For Avilo's demo, on autopilot (no Kenil review on this branch).

- A click anywhere on a table's row opens its record; links in cells are plain (`Grid.tsx`).
- Calendar and Knowledge Base open on their one table, no Overview (`straight` in `Module.tsx`).
  Knowledge Base 0.2.0 is one Documents table, Reports a kind of it, a list newest first.
- Network: Organizations back as a tab; Map, every row with a Location/City/Address by state
  (`/api/places`, `PlacesMap` in `People.tsx`). By state only: a street map needs a geocoder.
- Overview: Interview me on top with its name, then Files; no Show more, no Insights card.
- Charts: stage and funnel one card; no bubbles, no "New … by week", no first goal's weeks; heat
  only when two thirds of its squares are filled. Goals open in the side panel with Edit; Goals,
  criteria and "where from" start in the right column.
- DealPilot's Overview went from 15 cards to 10 (7 charts).
- Core tests: 13 in `core/src/modules` failed run in parallel and passed run one by one.
