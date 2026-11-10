# Your data, in the open

Alpha keeps a person's world in formats other tools open: SQLite and plain files. This is what
`alpha export` gives you, and what `alpha import` reads on a fresh install.

The archive `alpha-data-<date>.tar.gz` unpacks to one folder, `alpha-data/`:

| In it | What it is |
| --- | --- |
| `world.sqlite` | the world: every table, row, value with its provenance, card, task, person and journal line, as one SQLite database (open it with `sqlite3`, DB Browser or Datasette; each module's tables are ordinary tables named by their slug, a list relation's links a table of their own, every value's source in `provenance`). Rows waiting in the trash are left out: the archive holds what is there |
| `files/` | every file Alpha keeps, by the SHA-256 of its bytes |
| `modules/` | the module folders: each kit's schedules, skills, pages and notes as installed and as changed |
| `instructions/` | the standing instructions, one Markdown file for everyone and one per person |
| `connectors/` | the connectors added with `pnpm connector add`, each its folder |
| `alpha.yaml` | what the installer knew about the install |

Backups are the same `world.sqlite`, taken by SQLite's backup API (never a copy of the live
file): one a day (the last 7 days and one a week for the 4 weeks before), one before every shape
change, one on asking, and one before going back. `backups_copy` in `alpha.yaml`, a folder of yours
(iCloud Drive, Dropbox, a disk), gets the newest daily backup each day; the window has no control
for it. Time Machine on Alpha's data folder is fine too, since the live database is never copied,
only its backups.

`alpha uninstall` stops Alpha, takes it out of login and Applications, removes its secrets from the
Keychain and its logs, and resets what macOS let it read (Calendar, Contacts, notifications). The
data folder stays in your Library. `alpha uninstall --remove-data` also moves the data folder to the
Trash once you type remove: the worlds, files, kits, added connectors, browser sign-ins, the install
file and the token.
