# 29 October 2026: "send it" sends the draft

Kenil, testing slice 1 on his Alpha (13:02): "draft an email to me saying test", then "send it",
sent a second email and left the draft in Drafts; Alpha told him to delete it himself. His ask:
send the draft just made. On his "yes lets do it":

- Gmail's `draft` saves each draft under a Message-ID of Alpha's own and says it (`draft`).
- `send` takes an optional `draft`: the draft is read from Drafts and, when its To, Cc, subject
  and text are what the card shows (no Bcc, no attachments the card does not show), it is sent as
  it is (its own message, dated now, under its own Message-ID, so no double send still holds),
  then moved out of Drafts into Trash. A draft changed since, or gone, is refused and nothing goes.
  The card and Activity say "Send your draft to …".
- Tests in `connectors/gmail/src/index.test.ts` and three steps in the journey
  `mail-on-recorded-answers`, all failing before.
- **His run, 16:22:** the draft's result carried its id (read in the desk's transcript), yet Alpha
  sent "Test 2" as a new email and the draft stayed. So Gmail no longer relies on Alpha naming it:
  a send that names no draft, of an email a draft in Drafts already is (the newest few to its first
  address with its subject, compared as above), sends that draft and takes it out of Drafts. Test
  in `connectors/gmail/src/index.test.ts`, failing before.
