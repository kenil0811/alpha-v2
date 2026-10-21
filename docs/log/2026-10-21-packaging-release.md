# 21 October 2026: packaging, pieces 2 and 3, the release and its install

Built on from piece 1 the same night, on Kenil's word to carry on without waiting.

- **`pnpm release [version] [--working-tree] [--client <repo>]`** (scripts/release.ts): a clean
  copy of HEAD (or the working tree, for a try before a commit); the window built there; the
  payload staged with production packages only (Claude Code inside the Agent SDK's package);
  Node 26.12.0 and uv 0.12.17 fetched and checked against their published SHA-256 (cached in
  .data/release-cache); the helper built for macOS 14 and signed; bin/alpha and the launcher;
  VERSION and a MANIFEST of every file's hash. The smoke test starts the staged core with an
  empty HOME and only /usr/bin:/bin:/usr/sbin:/sbin, checks it answers and serves the window,
  installs the made-up kit and runs its agent in the sandbox, writes a log, a backup and a
  report, and the release stops if any of that fails. With --client, the kits the client's
  bundle.yaml lists are packed beside the app. Out: Alpha-<version>[-<client>].tar.gz holding
  Alpha/ (Alpha.app, install.sh, INSTALL.md, kits/). The first try: 649 MB as an app, 224 MB as
  the file with the first client's two kits.
- **release/install.sh:** checks Apple silicon, macOS 14, 3 GB free; takes the download mark off
  Alpha's own files only; installs to /Applications without sudo; on an update backs up every
  world first (updates/<time>/worlds), keeps the old app in previous/, and puts it and the data
  back if the new one does not answer within 90 seconds; hands the kits to kits/inbox; writes and
  loads the login item (RunAtLoad, KeepAlive on failure, ThrottleInterval 10, the app's own Node,
  helper and uv, macOS's own PATH, the readers' downloads and keep-awake on); runs Claude Code's
  own `auth login` when this Mac is not signed in; opens Alpha.
- **release/alpha** (the alpha command): status, open, start, stop, restart, logs, backup,
  restore, update, rollback, report (to the Desktop: versions, modules, tables with counts,
  connections, agents, recent errors and log lines; never rows), signin, uninstall
  [--remove-data] (login item, app, Keychain items, Calendar and Contacts grants and logs go; the
  data stays unless "remove" is typed). core/src/cli.ts does the backup, restore and report with
  SQLite's backup API.
- **This Mac** (Home while something essential is missing, and Settings): Claude's sign-in as
  Claude Code reports it, the reading browser and the document reader with their downloads,
  Gmail, Calendar and Contacts, Chrome, and Keep this Mac awake while plugged in (caffeinate -s
  for as long as the core runs, where the installed app asks for it).
- Not yet tried: install.sh and the login item themselves, which belong on a fresh macOS virtual
  machine (the plan's acceptance), not on Kenil's own account, whose dev core holds port 4700 and
  the same data folder. The alpha command was tried from an unpacked release in a scratch home.
