# 3 Nov 2026: one card for Agents, Governance and Tables; Files on top; one-word buttons

Vikas, on the Avilo demo; this branch ships without Kenil's review (Vikas, 2 Nov).

- Home and every Overview: Files on top as an explorer (folders by table and kind of document,
  straight into the files when there is one folder), Interview me, then `Working` in
  `Overview.tsx`: Agents, Governance and Tables in one card with a switch in its head. Agents
  shows New agent with none, so Knowledge Base has one. Second Brain's card is gone
  (`Intelligence` removed).
- Tile buttons are one word from a set (Review, Answer, Start, Fix, Open, Done), detail on hover;
  the spark is clipped to its own room, so it no longer runs under the button.
- The rows-per-week-by-kind line chart is gone from Overviews (`linesOf`, `Lines` removed).
- Find from an Overview names the module and its main tables and finds only its rows
  (`/api/find?module=`).
- "delete overview" from Calendar asked about Network's and DealPilot's: the model found the word
  in their notes and did not know an Overview is the window's own screen. Journey
  `delete-the-overview` (a step can now say `from:` a module) failed, then passed once the
  context says what an Overview is and that a thing named without a module is the asking
  module's.
