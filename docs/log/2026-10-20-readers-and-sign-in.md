# 20 October 2026: readers, sign-ins and clicking

The platform side of a day spent on a client's deal search kit; the kit's own story is in the
client's repository.

- **Kits:** a kit update adds a choice field's new choices where the kit puts them. Kit agents
  install paused; Turn on all and Pause all act on a module's agents (`POST
  /api/modules/:id/agents`), in Settings and on the module's Agents and notes. Settings folds a
  module's agents under its name and no longer lists its readers' sites.
- **A reader that meets a sign-in** opens a Sign in card (gate sign_in, tool `site_sign_in`). Sign
  in opens the site in the person's own Google Chrome, on Alpha's profile for that site, with
  nothing driving it (sites refuse sign-ins in a browser being driven, Google's included); the
  card is answered when they quit it, and the site is read with Chrome on that profile from then
  on (`channel: 'chrome'`, its keychain left in place so Chrome's saved sign-in opens). No Chrome
  on the Mac refuses the Sign in plainly. A sign-in form a page hides is no longer taken for a
  wall: only a visible password field is.
- **Robots rules** are read as RFC 9309 reads them (`*` and `$` as patterns, groups of several
  User-agent lines, the longest match, Allow on a tie): `robotsAllow` had cut a rule at its first
  `*`, shutting out sites whose rules allow their listings. Sites that answer 403 to an automated
  browser stay unread, never worked around.
- **extract** turns a page by a Next button when the control has no address, opens each listing
  not known yet by a click for the address it lands on (`open`, `known`), stops at a page of only
  sold listings (`stop`), and gives no ID when an ID pattern finds none.
- **Journeys:** a journey's browser reads only 127.0.0.1 and localhost, after a kit with real
  readers and its agents on read live sites once; a journey's kit step can name the agents it
  turns on.
