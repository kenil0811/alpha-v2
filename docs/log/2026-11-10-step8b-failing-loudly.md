# 10 November 2026: clean base step 8, failing loudly (production rules step 7)

Detail and Kenil's calls: https://claude.ai/artifact/DL7LCpTFGvdc3tSKLGpXQP.

- R1: every background job has a name. One that throws writes a journal line each time, and after two
  in a row opens one card on Home, which closes itself when the job next works. A schedule's run now
  asks after two failures too (his call), down from three.
- R2: a backup that fails is a card at once. The check for a backup not made by noon was dropped on his
  call, since Alpha being off until noon is not a fault. The rule now says only a failed backup.
- A3: each daily backup leaves a small manifest beside it (the day, the newest line and its hash), and
  a copy goes with the backup to the person's folder. `pnpm journal verify` and every start check the
  chain against the manifests. The rule no longer mentions a report, which never existed (his call).
- A4: a line that writes rows carries a short hash of each value it left. `verify` compares each row
  with the newest line that wrote it. To carry them, `add` and `change` write their rows first and their
  line after, with the line's id reserved for the rows to name. Pointers between rows are left out.
- Every journey now ends by verifying the journal and its rows.

Found on his look: the card opened but the window was not told, so Home showed nothing until reloaded.
The scheduler now tells it when a card opens or closes. A backups folder that is not a folder also
stopped the core at start, when it read the manifests; it no longer does.

Checked: `pnpm check` green, 22 rules held and none waiting on this step. The round in
`docs/journeys/2026-11-10-1203-summary.md` passed 29, left 1 waiting for Dell's contract, and failed
a-reader-for-a-list once on a model choice (it skipped the firm pages); it then passed 3 of 3 (the
`1204-run` reports). Every journey ends by verifying the journal and its rows. In WebKit and on his
look: a blocked backup's card opens and closes on Home without a reload.
