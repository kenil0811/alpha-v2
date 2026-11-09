# Journey a-rule-approved-later: 2026-11-09 10:33

A rule left waiting on its Save card is approved later from Settings › Permissions, and holds

Fresh tenant, model claude-opus-5-5, on Claude Code, Alpha's prompt alone.
**Passed** in 15 s, $0.13.


## 1. Connected gmail for owner@example.com, on recorded answers

Took 0.0 s.

- pass: rows in Mail: 6 (saw 6)

## 2. Said “From now on, never email anyone outside example.com.”

Reply (3.4 s): I've put the rule on a card for you: Alpha must never send email through Gmail to any address outside example.com. It only takes effect once you press Save on that card.

Steps: Worked on it.

Spent so far: claude-haiku-5-5: in 1179 (cache read 0), out 16; claude-opus-5-5: in 41943 (cache read 35995), out 222; $0.06.

- pass: a question card waiting (saw Save this rule? Alpha must never send to an address outside example.com through gmail.send, anywhere in Alpha. | )
- pass: SELECT id FROM journal WHERE kind = 'rule_saved' gives 0 (saw [])

## 3. Said “who has emailed me about deals this week?”

Reply (9.9 s): No one has emailed you about deals this week, or about anything else. The newest message in your mail, which was brought in this morning, is from 19 October.

The most recent deal emails are all from mid-October, and I've only looked at the headers, not the message text:

| Date | From | Subject | Status |
|---|---|---|---|
| 18 Oct | Marco Ruiz (brokerage), copying Priya Shah | Water damage business, $2.1M revenue | Unread |
| 16 Oct | ListingsHub Alerts (automated) | 3 new listings match your search | Read |
| 15 Oct | Priya Shah (Harbor Capital) | Re: Harbor deal: NDA attached (Harbor NDA.pdf attached) | Read |
| 13 Oct | Priya Shah (Harbor Capital) | Harbor deal: restoration contractor in St. Louis | Read, starred |

Dana Lee (leecpa) also wrote on 17 October about the "June close for Lakeside Builders". It could be deal-related, but the subject doesn't make that clear.

Steps: Looked through the tables; Looked through the tables.

Spent so far: claude-haiku-5-5: in 1179 (cache read 0), out 16; claude-opus-5-5: in 108519 (cache read 99998), out 1146; $0.11.

- pass: the reply matches /Priya/ (saw No one has emailed you about deals this week, or about anything else. The newest message in your mail, which was brought in this morning, is from 19 October.

T)
- pass: SELECT id FROM journal WHERE kind = 'rule_saved' gives 0 (saw [])
- pass: cards waiting: 1 (saw 1)

## 4. Approved “Alpha must never send to an address outside example.com through gmail.send, anywhere in Alpha.” in Mail's Governance

Took 1.3 s.

- pass: SELECT id FROM journal WHERE kind = 'rule_saved' gives 1 (saw [{"id":22}])
- pass: cards waiting: 0 (saw 0)
- pass: errors: 0 (saw 0)

## The world after

Mail: From (text), From address (email), To (text), Cc (text), Subject (text), Date (date), Labels (text), Thread (text), Message ID (text), Direction (choice), To addresses (text), Cc addresses (text), Attachments (text), Unread (choice), Starred (choice)

- from_table "Priya Shah <priya@harborcapital.example>" [looked_up], from_address "priya@harborcapital.example" [looked_up], to "owner@example.com" [looked_up], cc "" [looked_up], subject "Harbor deal: restoration contractor in St. Louis" [looked_up], date "2026-10-13T09:12:00.000Z" [looked_up], labels "Inbox" [looked_up], thread "t-harbor" [looked_up], message_id "<deal-1@harbor.example>" [looked_up], direction "received" [looked_up], to_addresses "owner@example.com" [looked_up], cc_addresses "" [looked_up], attachments "" [looked_up], unread "no" [looked_up], starred "yes" [looked_up]
- from_table "Priya Shah <priya@harborcapital.example>" [looked_up], from_address "priya@harborcapital.example" [looked_up], to "owner@example.com" [looked_up], cc "" [looked_up], subject "Re: Harbor deal: NDA attached" [looked_up], date "2026-10-15T16:40:00.000Z" [looked_up], labels "Inbox" [looked_up], thread "t-harbor" [looked_up], message_id "<deal-2@harbor.example>" [looked_up], direction "received" [looked_up], to_addresses "owner@example.com" [looked_up], cc_addresses "" [looked_up], attachments "Harbor NDA.pdf" [looked_up], unread "no" [looked_up], starred "no" [looked_up]
- from_table "ListingsHub Alerts <alerts@listingshub.example>" [looked_up], from_address "alerts@listingshub.example" [looked_up], to "owner@example.com" [looked_up], cc "" [looked_up], subject "3 new listings match your search" [looked_up], date "2026-10-16T06:00:00.000Z" [looked_up], labels "Updates" [looked_up], thread "t-bbs" [looked_up], message_id "<intro@listingshub.example>" [looked_up], direction "received" [looked_up], to_addresses "owner@example.com" [looked_up], cc_addresses "" [looked_up], attachments "" [looked_up], unread "no" [looked_up], starred "no" [looked_up]
- from_table "Dana Lee <dana@leecpa.example>" [looked_up], from_address "dana@leecpa.example" [looked_up], to "owner@example.com" [looked_up], cc "" [looked_up], subject "June close for Lakeside Builders" [looked_up], date "2026-10-17T11:05:00.000Z" [looked_up], labels "Inbox" [looked_up], thread "t-cpa" [looked_up], message_id "<cpa@firm.example>" [looked_up], direction "received" [looked_up], to_addresses "owner@example.com" [looked_up], cc_addresses "" [looked_up], attachments "" [looked_up], unread "no" [looked_up], starred "no" [looked_up]
- from_table "Marco Ruiz <marco@brokerage.example>" [looked_up], from_address "marco@brokerage.example" [looked_up], to "owner@example.com" [looked_up], cc "Priya Shah <priya@harborcapital.example>" [looked_up], subject "Water damage business, $2.1M revenue" [looked_up], date "2026-10-18T14:22:00.000Z" [looked_up], labels "Inbox" [looked_up], thread "t-brokerage" [looked_up], message_id "<broker-2@brokerage.example>" [looked_up], direction "received" [looked_up], to_addresses "owner@example.com" [looked_up], cc_addresses "priya@harborcapital.example" [looked_up], attachments "" [looked_up], unread "yes" [looked_up], starred "no" [looked_up]
- from_table "Restoration Weekly <news@example.org>" [looked_up], from_address "news@example.org" [looked_up], to "owner@example.com" [looked_up], cc "" [looked_up], subject "This week in restoration" [looked_up], date "2026-10-19T07:00:00.000Z" [looked_up], labels "Promotions" [looked_up], thread "t-news" [looked_up], message_id "<news@example.org>" [looked_up], direction "received" [looked_up], to_addresses "owner@example.com" [looked_up], cc_addresses "" [looked_up], attachments "" [looked_up], unread "yes" [looked_up], starred "no" [looked_up]
