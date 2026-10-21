# 21 October 2026: packaging, piece 1, the core for a fresh Mac

Kenil, 00:00 BST: "work on packaging ... start working on the first piece (dont wait for my
approval for it)". The plan is the project's "Installing Alpha on a fresh Mac" doc (agreed 20 Oct,
22:47 UTC, with his answers), copied on this Mac to ../packaging-draft/PLAN.md and INSTALL.md.

- **The helper:** the core uses the shipped helper when ALPHA_HELPER_APP names one and builds it
  only in development. Built for macOS 14 and later (`-target arm64-apple-macos14`,
  LSMinimumSystemVersion 14.0), identifier `io.github.kenil0811.alpha.helper`, signed with the
  "Alpha Code Signing" certificate when the Mac has it, else ad hoc. No hardened runtime: it would
  need entitlements for Calendar and Contacts, which Step B brings with notarization. With no
  helper, no password is kept in memory: connecting an account says why (`NoSecrets`).
- **uv and Docling** write their Python, cache and models in Alpha's envs folder
  (UV_PYTHON_INSTALL_DIR, UV_CACHE_DIR, HF_HOME, managed Python only), never ~/.local or ~/.cache.
- **The route** is this install's, kept in the world (`meta.model_route`), switched in Settings ›
  Model: the person's own subscription (Claude Code's own sign-in, ~/.claude left alone) or an
  API key kept in the Keychain, handed to each session with CLAUDE_CONFIG_DIR in Alpha's folder.
  Every session, the desk's and a document read's, runs with DISABLE_AUTOUPDATER. The route line
  left core/config/models.yaml.
- **One core per data folder** (core.lock, a stale one taken over); a taken port and a world from
  a newer Alpha are each refused in a sentence.
- **Daily backups** by SQLite's backup API, 7 days and one a week for 4 weeks; the backups before
  a migration stay apart. **Logs** go to ALPHA_LOG_DIR/core.log when it is set, rotated at 10 MB,
  5 kept.
- **Kit packs:** `pnpm kit pack <folder>` makes `<kit>-<version>.alphakit` (the kit and each file's
  SHA-256); packs in ALPHA_HOME/kits/inbox go in at start, kept unpacked in kits/<name>/<version>;
  Settings › Kits and agents installs or updates from a file. A pack changed after packing is
  refused.
- **Kept as decided:** the helper stays the owner of Calendar, Contacts and the Keychain after the
  Tauri shell comes (week 2's log said the shell would own them), so the shell's arrival asks
  nothing again.
- Kenil makes the "Alpha Code Signing" certificate once on his build Mac (Keychain Access ›
  Certificate Assistant › Create a Certificate, type Code Signing); until then builds are ad hoc,
  and macOS asks again after each.
