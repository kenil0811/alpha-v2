# 12–13 Nov 2026: the acting browser, steps 1 to 3

Item 4 of the agents plan, built on the branch `acting-browser` in the doc's order, each step looked
at by Kenil before the next. Not pushed yet.

- **Spike.** On the Mac, a hand sign-in in his own Chrome and then a driven headless Chrome reads
  Drive and Docs. On the server Google refused the sign-in; hiding that a program drives the browser
  was not done. Google on the server waits for a Drive and Docs connector over Google's API.
- **Step 1, profiles.** One profile per person and site (`profiles/<who>/<site>`, the site by the
  public suffix list), the firm's and the public one beside them; Connections › Sites lists a
  person's sign-ins with Sign in again and Sign out. Profiles stay out of downloads and backups.
- **Step 2, reading.** The `browse` tool: a tab per agent and piece of work, the page as numbered
  elements from its accessibility tree, a click by number (twice for a row that opens so), a tab a
  click opens followed, a small picture kept for each step and shown under it. A check page is
  waited out and tried again; one that does not clear waits for the person. Found on his Drive: a
  snapshot of one element numbers the whole page again, so what an element is comes from the view
  the agent saw.
- **Step 3, acting.** `type`, `key` and `choose`. Code decides what a step is before it runs
  (`core/src/engine/acting.ts`): reading, moving and plain clicks are free; typing, choosing, a
  key that types, Enter where text goes and Share, Publish or Post ask once for the agent, the site
  and the piece of work, and the yes holds for that work within its hours; a button or dialog that
  cannot be taken back asks each time; three yeses in a row offer Always, per agent, site and
  person; a deny rule on the site refuses. The card shows the page with the element outlined. The
  turn after a card's answer serves the same request, so the work's tab and its yes are found
  again. Rules L2 and L3 with their tests; journeys browse-reads-a-site, browse-acts-on-a-yes,
  browse-asks-each-time and browse-page-asks-for-data on made-up sites.

On his Mac's Alpha, on the Google account made for testing: a folder made in Alpha test and a file
moved into it on one card; a line added at the end of the doc Plan on one card for docs.google.com.

Next: his look at step 3, then step 4 (drawn pages) and step 5 (watch and take over).
