# Journey a-rule-approved-later: 2026-11-10 11:59

A rule left waiting on its Save card is approved later from Settings › Permissions, and holds

Fresh tenant, model claude-opus-5-5, on Claude Code, Alpha's prompt alone.
**Passed** in 16 s, $0.15.


## 1. Connected gmail for owner@example.com, on recorded answers

Took 0.0 s.

- pass: rows in Mail: 6 (saw 6)

## 2. Said “From now on, never email anyone outside example.com.”

Reply (2.6 s): I've put the rule on a card for you: Alpha never sends to any address outside example.com, anywhere in Alpha. It takes effect once you press Save on the card.

Steps: Worked on it.

Spent so far: claude-haiku-5-5: in 1179 (cache read 0), out 16; claude-opus-5-5: in 44739 (cache read 38753), out 197; $0.06.

- pass: a question card waiting (saw Save this rule? Alpha must never send to an address outside example.com, anywhere in Alpha. | )
- pass: SELECT id FROM journal WHERE kind = 'rule_saved' gives 0 (saw [])

## 3. Said “who has emailed me about deals this week?”

Reply (12.4 s): No one has emailed you about deals this week: the newest message in your mail is from 19 October. When I searched Gmail directly for the past week, it returned only two of Priya's October emails. That means its date filter isn't reliable, but nothing it returned was from November either.

The most recent deal emails, all from October and judged by subject line only, are:

| Sender | Date | Subject | Note |
|---|---|---|---|
| **Marco Ruiz** (brokerage) | 18 Oct | Water damage business, $2.1M revenue | Still unread, Priya copied |
| **ListingsHub Alerts** | 16 Oct | 3 new listings match your search | Automated alert |
| **Priya Shah** (Harbor Capital) | 15 Oct | Re: Harbor deal: NDA attached | Has Harbor NDA.pdf attached |
| **Priya Shah** (Harbor Capital) | 13 Oct | Harbor deal: restoration contractor in St. Louis | Starred |

Dana Lee, a CPA, also wrote on 17 October about the June close for Lakeside Builders. I left that out because the subject doesn't show whether it's about a deal.

Steps: Looked through the tables; Looked through the tables; Looked for the right connection; Searched Gmail for “after:2026/11/03”.

Spent so far: claude-haiku-5-5: in 1179 (cache read 0), out 16; claude-opus-5-5: in 166936 (cache read 157462), out 1322; $0.13.

- pass: the reply matches /Priya/ (saw No one has emailed you about deals this week: the newest message in your mail is from 19 October. When I searched Gmail directly for the past week, it returned )
- pass: SELECT id FROM journal WHERE kind = 'rule_saved' gives 0 (saw [])
- pass: cards waiting: 1 (saw 1)

## 4. Approved “Alpha must never send to an address outside example.com, anywhere in Alpha.” in Mail's Governance

Took 0.9 s.

- pass: SELECT id FROM journal WHERE kind = 'rule_saved' gives 1 (saw [{"id":27}])
- pass: cards waiting: 0 (saw 0)
- pass: errors: 0 (saw 0)

The journal verifies, rows included: 30 lines.

## The world after

Mail: From (text), From address (email), To (text), Cc (text), Subject (text), Date (date), Labels (text), Thread (text), Message ID (text), Direction (choice), To addresses (text), Cc addresses (text), Attachments (text), Unread (choice), Starred (choice)

- from_table "Priya Shah <priya@harborcapital.example>" [looked_up], from_address "priya@harborcapital.example" [looked_up], to "owner@example.com" [looked_up], cc "" [looked_up], subject "Harbor deal: restoration contractor in St. Louis" [looked_up], date "2026-10-13T09:12:00.000Z" [looked_up], labels "Inbox" [looked_up], thread "t-harbor" [looked_up], message_id "<deal-1@harbor.example>" [looked_up], direction "received" [looked_up], to_addresses "owner@example.com" [looked_up], cc_addresses "" [looked_up], attachments "" [looked_up], unread "no" [looked_up], starred "yes" [looked_up]
- from_table "Priya Shah <priya@harborcapital.example>" [looked_up], from_address "priya@harborcapital.example" [looked_up], to "owner@example.com" [looked_up], cc "" [looked_up], subject "Re: Harbor deal: NDA attached" [looked_up], date "2026-10-15T16:40:00.000Z" [looked_up], labels "Inbox" [looked_up], thread "t-harbor" [looked_up], message_id "<deal-2@harbor.example>" [looked_up], direction "received" [looked_up], to_addresses "owner@example.com" [looked_up], cc_addresses "" [looked_up], attachments "Harbor NDA.pdf" [looked_up], unread "no" [looked_up], starred "no" [looked_up]
- from_table "ListingsHub Alerts <alerts@listingshub.example>" [looked_up], from_address "alerts@listingshub.example" [looked_up], to "owner@example.com" [looked_up], cc "" [looked_up], subject "3 new listings match your search" [looked_up], date "2026-10-16T06:00:00.000Z" [looked_up], labels "Updates" [looked_up], thread "t-bbs" [looked_up], message_id "<intro@listingshub.example>" [looked_up], direction "received" [looked_up], to_addresses "owner@example.com" [looked_up], cc_addresses "" [looked_up], attachments "" [looked_up], unread "no" [looked_up], starred "no" [looked_up]
- from_table "Dana Lee <dana@leecpa.example>" [looked_up], from_address "dana@leecpa.example" [looked_up], to "owner@example.com" [looked_up], cc "" [looked_up], subject "June close for Lakeside Builders" [looked_up], date "2026-10-17T11:05:00.000Z" [looked_up], labels "Inbox" [looked_up], thread "t-cpa" [looked_up], message_id "<cpa@firm.example>" [looked_up], direction "received" [looked_up], to_addresses "owner@example.com" [looked_up], cc_addresses "" [looked_up], attachments "" [looked_up], unread "no" [looked_up], starred "no" [looked_up]
- from_table "Marco Ruiz <marco@brokerage.example>" [looked_up], from_address "marco@brokerage.example" [looked_up], to "owner@example.com" [looked_up], cc "Priya Shah <priya@harborcapital.example>" [looked_up], subject "Water damage business, $2.1M revenue" [looked_up], date "2026-10-18T14:22:00.000Z" [looked_up], labels "Inbox" [looked_up], thread "t-brokerage" [looked_up], message_id "<broker-2@brokerage.example>" [looked_up], direction "received" [looked_up], to_addresses "owner@example.com" [looked_up], cc_addresses "priya@harborcapital.example" [looked_up], attachments "" [looked_up], unread "yes" [looked_up], starred "no" [looked_up]
- from_table "Restoration Weekly <news@example.org>" [looked_up], from_address "news@example.org" [looked_up], to "owner@example.com" [looked_up], cc "" [looked_up], subject "This week in restoration" [looked_up], date "2026-10-19T07:00:00.000Z" [looked_up], labels "Promotions" [looked_up], thread "t-news" [looked_up], message_id "<news@example.org>" [looked_up], direction "received" [looked_up], to_addresses "owner@example.com" [looked_up], cc_addresses "" [looked_up], attachments "" [looked_up], unread "yes" [looked_up], starred "no" [looked_up]
