# 18 Nov 2026: Onboarding, step 2 (the never-use list)

Step 2 of the onboarding plan (calls 38 to 40, 44), built straight from the list. Rewritten from
`connector-sdk/src/never.ts` on the reference branch, not copied.

- The shipped list moved to `core/config/never.yaml`, in call 39's six kinds: banking, health and
  medical, passwords and credentials, legal matters, dating, personal money. Words match whole
  words, phrases their words in a row, stems the inside of a word. The old list's adult,
  gambling, religion and politics are gone, as call 39 names none of them. Everyday work words
  that are also on the old list (chase, hinge, court) were left off, since a match drops the
  whole mail.
- The firm's own words (the owner's) and each person's are kept in the world (`never_use`,
  migration 4). The journal says a word was added or taken off and for whom, never the word.
- Every call carries its connection's list (`CallOptions.never`). `makeCall` wraps the host so a
  matching row or file is left out before it lands, in the connector's own process (on a
  person's computer, before it leaves it), and again in the core as rows come back over the
  pipe. Each connection keeps how many its last read left out (`connections.left_out`), and its
  line in Connections says so, linking to Settings › Permissions.
- Settings › Permissions has Never use under the rules: each kind by name with a switch (its
  words are not shown, on Kenil's word of 19 Nov: they confuse people, and change in
  `core/config/never.yaml`), then Words for everyone here and Your own words. The short list gained a typed Add and a
  read-only form (ui-rules R8, I4, L11).
- Rule N1 with its test (five cases, one through the connector process as the Bridge runs it), and
  a journey, `what-is-never-kept`, which passes on recorded mail at no cost.

What the code showed the list missed: a firm whose own work is in a shipped kind (a dental
practice and its patients, a firm of lawyers, a bookkeeper) would have its own mail left out. So
the owner can turn a kind off for everyone; on by default. QuickBooks is untouched: it lands no
rows itself, and Avilo's Accounting reads it through its own scripts. What an agent reads through
a connector's tool in a turn (a mail search) is not filtered: the list holds for what lands.

Looked at in WebKit on Kenil's Alpha, light and dark.
