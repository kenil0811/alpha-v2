# 28 October 2026: a table kept as a tab

Kenil asked whether a table inside a deal or a client could be a tab that is always there; plan
https://claude.ai/artifact/8nrwqvhHUDso3R7gQUQwFK, his "yes" with the four calls as recommended.

A part or a setup table can now be kept as a tab of its module (`tables.tab`, migration 24;
`setTab` in `world/shape/parts.ts`, one `shaped` line). The tab shows every row of it, after the
module's main tables; where it sits doesn't change, so a part still shows on its row, is still
refused without one, and still goes with it. The person keeps or drops it in Agents and notes ›
Tables, in the table's ⋯ menu, or by chat (the shape tool's `keep_tab`, arrangement like setup,
never shape for a kit's maintainer). A kit says `tab: true` on a table; it is kept once, and a choice
anyone made since stands over a later version. `kit check` refuses `tab` on a main table.

Journey `parts-of-a-deal` gained "Keep Financials as a tab in Deal desk": on the old code the model
made Financials a main table, so a removed deal would have left its figures behind. Test
`world/tab.test.ts`.
