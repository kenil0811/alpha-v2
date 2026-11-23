# 23 Nov: Settings, four pages

PR 3 rebuilt from the reference on `claude/pr3-settings`, stacked on PR 0. Settings is General
(Appearance, Members, Set up Alpha, Alpha), Intelligence (Usage, Models, Automations,
Connections), Rules and Data (Logs, Backup and restore, Files). Each page scrolls as one, with its
parts as tabs pinned at the top that follow the scroll. Old addresses still land on their part.
Connections, sign-in apps, this computer's items and the ways to the model are small cards with a
dot (`ui/state-card.tsx`, built on `Frame`). The website rule is the first row of the rules list.
Activity is now Logs. Files with none shows a drop zone. The version and Check for updates are in
General (core `GET /api/update`, feed from `ALPHA_UPDATES`). Turning a rule or a switch off shows
a notice with the way back.

Not done: installing a module (from a file or a folder) left Settings with the Modules list; PR 4
brings a file's install back on New module, and a folder install has no place yet. The update
feed and its address are Kenil's to choose.
