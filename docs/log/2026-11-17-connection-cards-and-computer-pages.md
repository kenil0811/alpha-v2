# 17 Nov 2026: one shape for connection cards, a page for each computer

Kenil, looking at Connections on his server Alpha: the cards were not consistent, a problem leaked
out of its card, and the cards were too tall; then "all cards should be same length", lends should
not be listed under Your computers, and folders should move to a page per computer. His answer to
doc XFA9yyUZRd2VsiabECKEjU: all five calls as recommended.

- Every connection card has one shape: icon, name and account (or Not connected) at the top with
  its state and ⋮ at the right; its one act at the foot (Connect, or Read now with when it last
  read), kept at the bottom so cards side by side are one height. A problem takes the place of
  when it last read, one line in its state's colour, whole on hover and under Details (rule L11
  says so). A computer that is away says Offline in its pill alone. Add another account and
  Disconnect are in the ⋮.
- A computer that connects again is read at once (the hub's new `back`), so a folder's "Waiting
  for" goes as soon as its Mac is back, not at its next read. The server's own restarts left it
  showing beside an online Mac.
- Your computers: one short row a computer, what it lends in a few words, opening its page. A
  computer's page: how it stands, its Bridge's version, Lend a folder, Delete, what it lends as
  rows (a folder by its name, its path under it) and its latest reads (`GET /api/computers/:id`).
  The Folders section leaves Connections; on a Mac's own Alpha, This Mac is the computer whose
  page adds a folder by path, and a module's setup asking for a folder lands there.
- A connection's view is built in one place (`api/connection-view.ts`) for Connections and the
  computer's page.
- The pairing test now waits for the first read to finish before the next: a read still going was
  shared by the test's own read and missed its second file under load.
- Looked at in Safari's engine on Kenil's Mac Alpha with made-up computers and problems put in the
  page's answers, nothing stored.
