# 26 October 2026: delete is never one click

Item D4 of the gap register. Every action that destroys stored data was looked at. The ones on the
screen as a button now sit in a ⋮ (`ui/more.tsx`) that shows on the row's hover or keyboard focus:
Settings' Forget (how you asked things to be done), Disconnect (a connection, in a row or a tile),
Delete (a connector you added), a module field's Delete its values. A task's Delete moved from the
foot of its page to a ⋮ beside the title. Each already asked first in `Confirm`; the ones that did
not say whether it can be undone now do. Rows, saved lists and columns were already in menus and
confirmed. No `window.confirm` anywhere. Delete my data stays a button in Data: it is that
section's action and asks for the name typed. Revoke a permission stays: not a delete. Checked by
Biome, tsc and Vitest (one new render test); not seen in the app, as the Vite server has no data.
