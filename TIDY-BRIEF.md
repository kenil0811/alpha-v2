# Tidy-up of main before client modules: the brief

For the build thread. Delete this file before anything reaches main.

Read from main at ee1dfe9. Kenil's calls of 10 Nov 2026 are in the review doc
https://claude.ai/artifact/UeoDABDjs21KNVrgujLBvy, which is his written proposal and answer.
Every row is "Do it". Row 29 is his own call: "remove all tagging, only why is relevant".
Where a row's recommendation was to leave something (rows 22 and 25), "Do it" means leave it.

One step, built on the Mac, `pnpm check` green, a look in WebKit at the screens named, one log
entry, pushed on "looks good". Nothing here changes what Alpha does for a person, except rows 2,
3, 5, 6 and 7.

## 1. GitHub's check (row 1)

Main has failed GitHub's check on every push since 5 Nov (22 runs; the last green was f5c2967 on
3 Nov). Every failure is a script in the sandbox ending with "The script ended without an answer
(exit 1)" (scripts/run.test.ts, modules/walls.test.ts, modules/runs/wake.test.ts, R7 in
rules/schedules.test.ts). They pass on the Mac and on Linux with bubblewrap.

Likely cause: Ubuntu's `bwrap-userns-restrict` AppArmor profile, which release/server/setup.sh
turns off and .github/workflows/check.yml does not. In check.yml's "What the sandbox needs on
Linux" step, after the sysctl, add what setup.sh does:

```sh
if [ -f /etc/apparmor.d/bwrap-userns-restrict ]; then
  sudo ln -sf /etc/apparmor.d/bwrap-userns-restrict /etc/apparmor.d/disable/bwrap-userns-restrict
  sudo apparmor_parser -R /etc/apparmor.d/bwrap-userns-restrict 2>/dev/null || true
fi
```

Unproven: confirm on the push. If it is still red, the next suspect is the profile's other name on
the runner's Ubuntu (`ls /etc/apparmor.d | grep -i bwrap` in the step).

## 2. Wrong today (rows 2 to 7)

2. The model is sent to Governance, which is gone. Say Settings › Permissions:
   - core/src/gates/gates.ts:107 (refusedBy) and :141 (the noticed reason)
   - core/src/engine/tools/desk.ts:136 (rule tool description) and :181 (its reply)
3. The model is told Settings › Connections. Say Intelligence › Connections:
   - core/src/engine/tools/desk.ts:214, core/src/connectors/service.ts:476 and :496,
     core/src/connectors/served.ts:46 and :51, comment in core/src/api/routes/tables.ts:19
4. kit-sdk/src/index.ts:342 says Settings › Modules: say Intelligence › Modules, then
   `pnpm kit-api` (docs/kit-api.md is generated).
5. POST /api/data/remove (api/routes/settings.ts:202) has no caller. Delete the route, removeData
   in core/src/data.ts if nothing else uses it, its tests, and its door in core/src/rules/doors.ts.
   Then docs/data.md's last paragraph says what `alpha uninstall --remove-data` does: stops Alpha,
   moves the data folder to the Trash after "remove" is typed, deletes Alpha's Keychain items,
   removes the app. (Or keep the route and make the command call it: Kenil's call was the
   recommendation, which is delete or wire, so delete is the smaller change.)
6. release/server/alpha has no export. Add `export` (POST /api/data/export with the token, as the
   Mac's command does, printing where the archive is). Add export and import to release/alpha's
   usage line at its end.
7. agentReach (core/src/world/agents/index.ts:157) is never called. Call it where an agent's run
   or desk is set up, so the one place a limit would go is real, returning null as today.

## 3. Docs (rows 8 to 16)

8. release/INSTALL.md describes the old Mac app (face in a corner, ⌃⌥A, modules already there,
   Settings › Modules, Turn on all, Kumo, readers under Settings › Permissions). Rewrite it for the
   Mac app as it is now, short.
9. connectors/README.md: added with `pnpm connector add <folder or pack>`, not from Connections;
   drop the lines on the release packing connectors-extra and updating them at start.
10. docs/design.md, The window (Kenil's yes is in the doc): the rail is Home, Agents, Tasks and
    the modules; the assistant starts closed and opens from Alpha's face at the right of the bar.
11. docs/ui-rules.md: rewrite M4 (New module opens Agents on the Module builder, the Chief of
    staff once it has gone); S8's date "2 Sep" is a typo, find the right one in the log or git
    (likely 2 Nov); renumber or leave the M3 and L15 gaps.
12. docs/ui-contributions.md:213 "the workspace menu at the top of the rail, then Appearance" is
    Settings › Appearance; :235 drop "§14".
13. docs/setup/google-app.md: delete (it is on reference/full-2026-11-06).
14. docs/data.md: "Keep a copy in a folder" is `backups_copy` in alpha.yaml, no control in the
    window; connectors are added with `pnpm connector add`, not from Settings.
15. biome.json: drop "!BRIEF.md". CLAUDE.md: pnpm check is types, lint, tests, the time-zone
    tests, the walls and the rules.
16. docs/rules.md: "skip (step 8)" and "step 8" mean the production plan's step 8; say "with Dell's
    contract" instead, in the Held by key and the table. Check scripts/rules-check.ts and
    core/src/rules/check.ts, which parse that column, and the it.todo text in core/src/rules/rule.ts.

## 4. Stale code (rows 17 to 25)

17. "Alpha's own loop" in comments: core/src/engine/gate.ts:2, core/src/engine/registry.ts:74,
    core/src/engine/gate.test.ts:1, core/src/journeys/run.ts:526. Reword to the one provider.
18. core/src/journeys/run.ts:99, :247, :409, :417 say Governance; say Permissions. Also
    core/src/api/waiting.test.ts:1 and :56.
19. Settings › This Mac in core/src/setup.ts:106, core/src/install.ts:5, core/src/api/types.ts:162:
    the keep-awake switch is in Settings › Permissions, On this computer.
20. core/src/api/connector-types.ts:63 (comment for a removed field), window/src/Conversation.tsx:68
    (Governance's + Add), window/src/App.tsx:148 (redirect for New module's old page: remove the
    redirect too, as step 2 dropped old-link redirects), core/src/modules/defaults.ts:1 (Network),
    core/src/api/routes/rules.ts:1 and core/src/api/types.ts:179 (Governance).
21. Take out the exploring session the onboarding plugin used: exploreOnce in
    core/src/engine/ask.ts (and the file if nothing else is left in it), the host's `explore` in
    core/src/plugins/plugins.ts, `explore`, `Catalogue` and `Explored` in plugin-sdk/src/index.ts
    if nothing else uses them, and `explore_turns` and `explore_look_tokens` in core/config/limits.yaml
    and core/src/config.ts. The plugin seam stays. Check the test plugin and plugins.test.ts.
22. Leave core/src/modules/defaults.ts (default kits): a default module may come back.
23. Delete the unused exports: ModelsConfig and LimitsConfig (core/src/config.ts), NAMES_BOTH
    (core/src/world/people/types.ts), KitSetup (kit-sdk/src/manifest.ts), parseScheduleText
    (kit-sdk/src/schedule.ts). Leave the ~115 exports used only in their own file.
24. docs/journeys: keep each round's summary and the latest report of each journey that exists;
    delete the rest (518 reports today, 28 of them for journeys that are gone). Delete
    docs/log/spikes. Both stay on reference/full-2026-11-06 and in git history. Say in
    journeys/README.md that older reports are in git history.
25. Leave the 90 old branches for the clean-up planned later.

## 5. Structure and Kenil's rules (rows 26 to 29)

26. Move Intelligence's screens out of window/src/Settings.tsx: Connections (STATE, ICONS,
    ConnectionLine, ConnectorTile, FolderForm) to window/src/Connections.tsx, and Schedules and
    RunNow to window/src/Schedules.tsx. No behaviour change. Settings.tsx drops about 460 lines.
27. scripts/long-files.ts: set each allowance to the file's count after this step (today
    TableView 703, Grid 1208, Settings about 600 after row 26 so maybe off the list, Shell 669,
    Tasks 675, core/src/api/types.ts 650).
28. and 29. Remove every provenance tag from comments in core/, window/, kit-sdk/,
    connector-sdk/, plugin-sdk/, connectors/, connectors-extra/, scripts/, release/, mac/ and
    core/config/, keeping only the why. A tag is any pointer to where or when something was
    decided: "(core step 3d)", "(decision 12, step 4)", "(Batch A, call 10)", "(item 16 of the
    problems list, 25 Oct)", "(onboarding 4a)", "(Kenil's yes 27 Oct)", "(Kenil, 21 Oct)",
    "(Vikas, 25 Oct)", "(clean base step 7)", "(rulebook §2)", "(step 10, from v1's …)". About 418
    lines; that pattern finds most of them:

    ```
    git grep -nE "\((core step|step [0-9]|decision [0-9]|Batch [A-E]|item [0-9]+|onboarding [0-9A-Z]|call [0-9]|Kenil|Vikas|clean base|rulebook)|[0-9]{1,2} (Oct|Nov)\b" -- core window kit-sdk connector-sdk plugin-sdk connectors connectors-extra scripts release mac
    ```

    Keep a comment's reason, drop its tag; a comment that was only a tag goes. Test names keep
    their rule ids (R7, D2, T4): those name a rule in docs/rules.md or docs/ui-rules.md, which is
    what is, not history. Vikas's name goes from every code comment this way (9 lines in 8 files:
    core/config/words.yaml, core/src/engine/tools/walls.ts, window/src/App.tsx, Record.tsx,
    Shell.tsx, look.test.ts, moduleIcon.tsx, table/KindPicker.tsx, vocabulary.ts). The log keeps
    its history as written.

## Checks

- `pnpm check` green on the Mac, and GitHub's check green on the push.
- `pnpm kit-api` run after row 4; docs/kit-api.md committed.
- A look in WebKit: Intelligence › Connections and Schedules after row 26, Settings › Permissions,
  New module, a refused rule's words in the chat.
- No journey needs to run: only the words the model reads change (rows 2 and 3). Run
  a-rule-holds and connection-waits once if time allows.
