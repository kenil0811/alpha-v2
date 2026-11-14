# 14 November 2026: what a client's first kit on this base needed of Alpha

Kenil settled a client's three modules and said yes to step 1's detail
(https://claude.ai/artifact/XgXkXaeYMeuVTBU22Vi1kV). The kit itself is in the client's own
repository. Three things here, all generic, on the branch `kit-second-read`, not pushed:

- **A kit test can run again in the same world.** `then` in a case (`tests/<name>.yaml`) is a list
  of later runs, each with the pages a site shows by then and what to expect of that run, so a
  reader's second read can be tried without the model: a new listing, a changed one, one gone. A
  failure names the run ("Run 2: …"). The test kit has a case of it (`read-again`).
- **A kit's schedule wakes on a change in a table of another kit it uses, and reads it.** This was
  read in the code but never run. `runs.test.ts` now holds it: a second kit with `uses` on the
  first one's table and `trigger: { changes: … }` runs once on the change, reads the table, lands
  in its own, and its own write does not wake it again.
- **A table reached from the rail opens on its default list.** Since the table's frame is drawn
  before the table arrives (10 Nov), the frame, which has no lists, decided the opening list, so a
  kit's default list was shown only on a fresh load of the table's address. The list is now picked
  when the table itself arrives, unless the person has a working list there, and nothing is kept
  for a frame. Seen in WebKit on the Mac's Alpha: from the rail, the client's table opens on its
  front list.

Found, not changed: a client's kit has no way onto a server from the Mac but a signed pack through
Intelligence › Modules, which is not yet tried; a script sees only a mail's headers (the Mail
table), so a source read from its alert mails would need a kit call for a mail's text.
