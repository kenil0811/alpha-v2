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
| `connectors/` | the connectors added from Settings, each its folder |
| `alpha.yaml` | what the installer knew about the install |

Backups are the same `world.sqlite`, taken by SQLite's backup API (never a copy of the live
file): one a day (the last 7 days and one a week for the 4 weeks before), one before every shape
change, one on asking, and one before going back. "Keep a copy in a folder" puts the newest daily
backup in a folder of yours each day (iCloud Drive, Dropbox, a disk); Time Machine on Alpha's
data folder is fine too, since the live database is never copied, only its backups.

`alpha uninstall --remove-data` is yours alone: it takes the worlds, files, kits, added connectors, browser
sign-ins, the install file and the token to the Trash, removes Alpha's secrets from the Keychain,
and starts Alpha again as on its first open. The readers' downloads stay, since they are Alpha's.
