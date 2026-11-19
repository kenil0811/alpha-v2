# 18 Nov 2026: Onboarding, step 2 (the never-use list)

Step 2 of the onboarding plan (calls 38 to 40, 44), built straight from the list. Rewritten from
`connector-sdk/src/never.ts` on the reference branch, not copied.

- The shipped list moved to `core/config/never.yaml`, in call 39's six kinds: banking, health and
  medical, passwords and credentials, legal matters, dating, personal money. Words match whole
  words, phrases their words in a row, stems the inside of a word. The old list's adult,
  gambling, religion and politics are gone, as call 39 names none of them. Everyday work words
  that are also on the old list (chase, hinge, court) were left off, since a match drops the
  whole mail.
- Every call carries the list (`CallOptions.never`). `makeCall` wraps the host so a
  matching row or file is left out before it lands, in the connector's own process (on a
  person's computer, before it leaves it), and again in the core as rows come back over the
  pipe. Each connection keeps how many its last read left out (`connections.left_out`), and its
  line in Connections says so.
- Nothing of it is in Settings, on Kenil's word of 19 Nov: the words confused people, and the
  list changes in `core/config/never.yaml` alone. A first build had Never use in Settings ›
  Permissions (each kind with a switch for the owner, and words of the firm's and each person's,
  in a `never_use` table); it went before reaching main, and the `never_use` table was dropped on
  his Mac and server Alphas, which had run that build.
- Rule N1 with its test (four cases, one through the connector process as the Bridge runs it), and
  a journey, `what-is-never-kept`, which passes on recorded mail at no cost.

Left open: a firm whose own work is in a shipped kind (a dental practice and its patients, a firm
of lawyers) would have its own mail left out; when one comes, its Alpha needs a way to turn that
kind off in its own configuration. QuickBooks is untouched: it lands no rows itself, and Avilo's
Accounting reads it through its own scripts. What an agent reads through a connector's tool in a
turn (a mail search) is not filtered: the list holds for what lands.

Looked at in WebKit on Kenil's Alpha, light and dark.
