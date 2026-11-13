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

His look at step 3 found, and the same day fixed: an agent working for another answered "blocked"
at its card, so the yes started nothing (the answer tool now refuses that while the card waits); a
session resumed after the update still believed it could not type (a session now starts afresh when
its tools say something new); each click on Drive waited 16 seconds for a network that never goes
idle (a step now waits for the page to stop changing); and a card showed before the words that
explain it (ui-rules A10). Steps 1 to 3 pushed on his "looks good" (6c3ff3c).

- **Step 4, drawn pages.** A click at a place in the picture (`x`, `y`), judged by what is at that
  place as a click by number is; `read`, an address read as text as the person without opening it
  as a page (a site's own text export); each step says the page's address. Journey
  browse-works-a-drawn-page on a made-up document drawn on a canvas. On his doc Plan: its text
  export read, and words typed at the end of its first line after a click there.

Step 4 pushed on his "looks good" (e51dacf).

- **Step 5, watch and take over.** A work's tab as a live picture (`LiveTab`, `/ws/watch/:tab`,
  `LivePage.tsx` shared with the sign-in picture), offered as Watch while an agent works. Take over
  holds the page: what the person does reaches it and passes no gate, every step of the agent's on
  it is refused and the agent waits, and Hand back lets it carry on, told to look at the page
  first. The record keeps one line, that they had it and for how long. An agent asks the person
  onto a page with `hand_over`, and the browse tool does so by itself at a check page that does
  not clear; handing back answers that card. Only the person the work acts as can list, watch or
  hold its tab (rule L3). Tried on his Mac's Alpha on Drive: watched, taken over, handed back, and
  the agent carried on; and an agent's own ask onto the page.
  His look found two faults in the picture's input, both fixed: a key whose release never reached
  the window stayed held on the page (a press now says which keys are really held, and all are
  let go when the page changes hands), and two quick presses never made a double click, so a
  Drive folder was selected and never opened (each press now carries its count).
  Then two more: a right click in the Mac app selected the whole picture (nothing in it is the
  window's to select now), and a page closed while the agent was idle could not be opened again
  (the conversation offers it for as long as the tab is open).
  And a page the person watches or has in hand is never closed for idleness: its thirty minutes
  start again when they let go.

Step 5 accepted by him on 13 Nov. Next: the Drive and Docs connector over Google's API, for the server.
