# 1 November 2026: onboarding step 3, the three connectors for this computer

From the final design (~/Desktop/dev/alpha/onboarding/design.md, §3 and §5), Kenil's "makes sense" of
18:16 to the detail, with my default that the three are kept from the model.

- Connector SDK: a manifest's `parts` (each with its own access) and `private` (its tools are never
  offered to the model, and it reaches no host); `Host.local` (the computer's reader) and
  `Host.never` (the never-use list), both handed across the connector's own process as the helper
  and the browser are; a connector's `access`, its parts in the five words. A `system` connector
  with parts names no settings pane: the platform says where.
- The core: `ServiceOptions.local` from `platform.local(helper)` in main.ts; a private connector has
  no model-facing tool name, no MCP entry and no tile in Connections or step on Home (onboarding's
  cards connect it, step 6). Migration 31: `connections.never`, set with `setNever`, journaled as a
  count, never the names.
- `connectors/this-computer/`: browsing (Chrome, Safari; `sites`), apps (installed, time in apps;
  `apps`), file names (Documents, Desktop, Downloads; `files`), no network, no tables, checked by
  asking the reader. The filters (`filters.ts`), before anything is counted: an address becomes its
  site, local and browser pages go; the shipped never-use list (whole words, and stems inside a
  name) and the person's own; titles lose addresses, phone numbers and runs of five digits, and
  webmail and messaging titles go whole; a site seen on one day is left out; files as a tree two
  levels deep by kind, a project as one, the 300 newest names.
- Tests: every filter; the three tools across their processes on a made-up reader, a locked part
  not read; the never-use list honoured; kept from the model; "Not on this computer" with no reader.
  Two tests that load the whole standard set twice now have 30 s, as the others that do.
- `pnpm onboarding-trial --count` runs the three as the core does on the real Mac and prints counts
  only; the names stay in .data for the person. On Kenil's Mac without Full Disk Access: Chrome 6
  sites after the filters (of 52, most seen on one day), 101 apps, 78 folders and 300 newest names.
- With Full Disk Access (2 Nov): Chrome and Safari 138 sites after the filters, 110 apps (16 with an
  hour a week or more), the same folders. The run showed 9 apps with Screen Time hours (28 of 190)
  that live outside the app folders (Finder, helpers); they now count, named by Spotlight in the Mac
  reader (`appName`, mdfind; no helper rebuild) and by their id where it has no name.
