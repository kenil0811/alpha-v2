# 30 October 2026: a connection waiting for the customer, and who set it up

Step 2 of the final plan, part 4, on Kenil's "ok" (13:34).

- A fifth connection state, `waiting`: a connector's check throws a Problem of kind `waiting`
  with what the customer must do; `connect` keeps the connection (as a browser sign-in does),
  `syncDue` skips it, and a sync of it checks first (Try again in Connections, Read now's route),
  reading only once the check passes. Migration 29 makes the connections table again, as SQLite
  grows a CHECK no other way.
- The window: "Waiting for the customer" in amber with the words, Try again in place of Read
  now; Home's Needs you lists it beside sign-ins (`attention.waiting`). "Set up by You" on each
  connection (`owner`, from `made_by`).
- Journey `connection-waits` with a made-up connector (`journeys/fixtures/connectors/tenant`):
  waiting with the words, not read on the tick, connected and read on Try again once the
  customer's file is there. Runner: `{tmp}` is the journey's own folder, `customer_does` writes a
  file there, `try_again` syncs; check `connection`; a made-up connector gets the SDK linked; a
  single journey's crash is said on the console.
- On the way: migration 29 in `world/migrate29.ts` and the take-backs' `undoOf`/`takeBack` in
  `connectors/takeback.ts`, as `migrations.ts` and `service.ts` were at their walls. A broken
  edit of migrations.ts kept Kenil's Alpha down for three minutes (13:48–13:51); nothing touched
  his world.
