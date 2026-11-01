# 1 November 2026: onboarding step 1, the trial on Kenil's Mac

From the final design (~/Desktop/dev/alpha/onboarding/design.md, §10 step 1), his yes of 17:44.
Started ahead of Batch C on his word (17:39). Nothing left the Mac; no model was asked.

- Alpha's helper gained six commands, returning raw rows and deciding nothing: `safari-visits`,
  `apps` (Spotlight's last use and use count), `app-time` (Screen Time's knowledgeC.db, else what
  the Biome streams hold), `files <folder>` (names, kinds, dates; hidden files, bundles,
  node_modules, .git and Library left out; at most 50,000), `access <part>` (ready, settings,
  absent, refused) and `show-settings <part>` (Full Disk Access, with Alpha shown in Finder). The
  helper links SQLite and names three folders in its Info.plist.
- `core/src/platform/readers/chromium.ts`: every profile's history from a copy, Chromium's
  microseconds since 1601 read as big integers.
- `pnpm onboarding-trial` (`core/src/platform/trial.ts`): reads every source as the app, times
  each, writes the raw answers to `.data/onboarding-trial/` (never committed) and a report of counts;
  `--settings` opens Full Disk Access; `--record` writes the recordings in
  `core/src/platform/fixtures/mac/` with every site, title, path and app replaced, and a test fails on
  any real name in them.

What the trial found on macOS 26.6.2:

| Source | First run | With Full Disk Access |
|---|---|---|
| Documents, Desktop, Downloads | three dialogs naming Alpha; 1,539, about 50,000 (the cap) and 2,770 files | 0.1 to 1 s each |
| Apps | 101 apps; Spotlight has a last use for 23 | 0.2 s |
| Chrome | 593 visits, 52 sites in 90 days | under 0.1 s |
| Safari | locked | 20,588 visits, 651 sites, 87% with titles, 0.3 s |
| Screen Time | locked | knowledgeC.db still written: 6,612 spans, 34 apps, 190 hours since 8 Oct, 0.2 s |

- Alpha was not in the Full Disk Access list: Kenil dragged it in from the Finder window
  `show-settings` opened. The card leads with dragging, and switching on is the second case.
- Screen Time's old store answers on macOS 26.6, kept for about 24 days; the Biome reader is not
  needed yet, and step 8's journey fails loudly if both stores come back empty.
- Spotlight knows the last use of only a quarter of the apps: the Apps card leans on Screen Time.
- One code folder held 49,643 of Desktop's entries and filled the cap: step 3 counts a folder with a
  `.git` as one project and walks newest first, so the cap never hides recent files.
- The helper is signed ad hoc on this Mac (no "Alpha Code Signing" certificate), so each rebuild of
  it may ask again for the Keychain, Calendar, Contacts, the folders and Full Disk Access.
