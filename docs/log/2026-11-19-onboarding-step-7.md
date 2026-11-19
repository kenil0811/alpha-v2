# 19 Nov 2026: Onboarding, step 7 (the report module and its page)

Step 7 of the onboarding plan (calls 26, 29, 30 and 32), built straight from the list: Your work
0.3.0.

- Its report page (`pages/report.html`), the page the module opens on, in the document look: a
  person's workflows by rank, each with how often and how long (counted, their answer, or
  estimated, as the value's own source says), what the data shows and what it means, its steps
  as a flow with where it stalls, and what Alpha would build with the person's answer, or why it
  is not worth building. With more than one person interviewed, a chooser picks whose. It prints
  to PDF as every page does, and every number opens its row.
- Workflows open by rank (the By rank view); the person may move one by changing its Rank.
- A flow block in the page kit (`doc.js`, `kit.css`): steps in order as tiles, each after the
  first marked as following it, a stalling step in the bad tone; it never breaks across a
  printed page.

Looked at in WebKit with a made-up report rendered outside any Alpha, at a wide and a narrow
width.
