# 29 October 2026: each connector in its own process

Step 2 of the final plan (the connector platform), part 1 (connectors in a sandbox, signed),
slice 1, on Kenil's "makes sense lets begin": a connector package's code no longer runs in the
core's process.

- `connectors/child.ts` is the connector's process: it imports the package, checks it, says what
  its connectors are, then answers check, sync, files, run and "what is this call" one line at a
  time. `connectors/process.ts` is the core's side: the process, its pipe, and the stand-in
  connectors the rest of the core holds as before. The host's asks (secret, land, keepFile, keys,
  the browser) are answered by the core's host for that call; a journal line and a new cursor are
  told.
- The connector SDK's host says `land`, `keys`, `keepFile` and the browser's methods may answer
  later: Gmail, Mac, Files and LinkedIn await each.
- The gate's `before` is async: it asks the connector what a call is (its effect for this input,
  its card, its words) before the gates. The service's sync `effect`, `preview` and `words` are
  gone into `says`.
- A connector folder's processes start together; each holds the core up only while a call waits
  on it (a script that loads the set and syncs ends when it is done).
- Test: `connectors/process.test.ts` (a connector journals its own pid; failed before: same pid).
- **Found on his Alpha:** his LinkedIn was the copy added from the 23 Oct pack, written to the old
  host (no awaits), so its sync broke ("object is not iterable"). Alpha's own added connectors now
  update as its kits do: at start, an added `@alpha/connector-*` folder older than the newest pack
  the release brought in `connectors/available/` is replaced by it, with a journal line ("Updated
  the connector LinkedIn to 1.1.0, Alpha's own."); Connections offers each pack at its newest.
  LinkedIn 1.1.0. Test in `connectors/discover.test.ts`, failing before. A connector of someone
  else's written to the old host would fail the same way, said on its connection; there are none.
