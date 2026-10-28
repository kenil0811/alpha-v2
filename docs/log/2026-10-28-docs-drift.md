# 28 October 2026: the documents caught up with the code

Every document read against the code at 6328e98 (alpha-avilo at 92be1e5) and against Kenil's
decisions in the plans. Documents only: no code, test, kit or generated file changed.

- `docs/design.md`: Dell on Microsoft SQL Server, not MySQL, after its contract and on its own
  server (§1, §8, §15, §19); the repository as it is (§3); `record_versions` (§4); facts not a
  part of their own yet (§4); an agent's run is its script, and the brief-driven agent decided,
  not built (§5, §11); the fifteen world tools `engine/tools/` serves, no `tell` (§5); the prompt
  quoted as `core/config/system.md` has it (§6); the auth kinds and secret store as built, OAuth
  with a sign-in app the client owns (§8); readers and connectors one concept, and the platform
  step (§8); no Python and no XState in kits (§2, §9, §10, §11); Intelligence › Connections and
  Settings › Modules (§8, §10, §11); the server as Kenil answered on 25 Oct (§15); CI checks
  Network's kit only (§15); Stage 2, the core plan and what follows (§19); still open.
- `docs/ui-rules.md`: Home (O1, O2), the assistant on every screen (A5), long replies fold (A6),
  grey marks for what Alpha is not sure of (R7), a part's small table (T4), all already in
  design §14; I3 before I4.
- `BRIEF.md`: a note of what changed since 19 Oct; MySQL corrected.
- `CLAUDE.md`, `README.md`, `connectors/README.md`, `journeys/README.md`, `release/INSTALL.md`
  (Intelligence › Connections, Settings › Modules and Permissions), `docs/data.md` (the archive
  holds no model views), `docs/setup/google-app.md` (no Google app of Alpha's own).
- Left for a decision in code, with the reasons, in the drift report: `kit-sdk`'s "Settings ›
  Kits" in the generated kit API page; CI not checking Alpha's own kit; the Terminal steps a
  client still needs; two kit notes that name the wrong place in the window.
