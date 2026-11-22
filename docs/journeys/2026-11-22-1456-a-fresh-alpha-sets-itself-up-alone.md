# Journey a-fresh-alpha-sets-itself-up: 2026-11-22 14:56

The owner of a fresh Alpha with interviews off goes through Welcome, Claude, Your workspace, Connect, Your people and Done, and lands on a Home that works

Fresh tenant, model claude-opus-5-5, on Claude Code, Alpha's prompt alone.
**Failed** in 1 s, $0.00.


## 1. Connected gmail for ana@harborbooks.example, on recorded answers

Took 0.0 s.

- **FAIL**: the owner's story: chapters welcome, claude, workspace, connect, people, done; at welcome; not done; Home row /Carry on setting up/ (saw 404: ; at undefined; not done; row none)

## 2. **The owner could not go through welcome (404: {"message":"Route POST:/api/story/welcome not found","error":"Not Found","statusCode":404}).**

Took 0.0 s.


## 3. The owner's claude was refused: {"message":"Route POST:/api/story/claude/skip not found","error":"Not Found","statusCode":404}

Took 0.0 s.

- **FAIL**: the owner's story: at claude (saw 404: ; at undefined; not done; row none)

## 4. **The owner could not go through claude (404: {"message":"Route POST:/api/story/claude not found","error":"Not Found","statusCode":404}).**

Took 0.0 s.

- **FAIL**: the owner's story: at workspace (saw 404: ; at undefined; not done; row none)

## 5. **The owner could not go through workspace (404: {"message":"Route POST:/api/story/workspace not found","error":"Not Found","statusCode":404}).**

Took 0.0 s.

- **FAIL**: the owner's workspace says /Harbor Books/ (saw 404: {"message":"Route GET:/api/story/workspace not found","error":"Not Found","statusCode":404})

## 6. **The owner could not go through connect (404: {"message":"Route POST:/api/story/connect not found","error":"Not Found","statusCode":404}).**

Took 0.0 s.

- **FAIL**: the owner's connect says /\d+ (mails|emails)/ (saw 404: {"message":"Route GET:/api/story/connect not found","error":"Not Found","statusCode":404})

## 7. **The owner could not go through people (404: {"message":"Route POST:/api/story/people not found","error":"Not Found","statusCode":404}).**

Took 0.0 s.

- **FAIL**: the owner's people says /Priya/, never /sent/ (saw 404: {"message":"Route GET:/api/story/people not found","error":"Not Found","statusCode":404})
- pass: “Gmail: send” 0 time(s) (saw 0)

## 8. **The owner could not go through done (404: {"message":"Route POST:/api/story/done not found","error":"Not Found","statusCode":404}).**

Took 0.0 s.

- **FAIL**: the owner's story: done; no Home row (saw 404: ; at undefined; not done; row none)
- pass: no trace of the interviews plugin (saw none)
- pass: 0 cards in Needs you (saw none)
- pass: errors: 0 (saw 0)

## 9. Said “What can you do for me?”

Reply (0.6 s): Alpha can’t reach Claude yet: Claude isn’t signed in here.

Spent so far: nothing yet.

- **FAIL**: errors: 0 (saw 1)

The journal verifies, rows included: 12 lines.

## The world after

Mail: From (text), From address (email), To (text), Cc (text), Subject (text), Date (date), Labels (text), Thread (text), Message ID (text), Direction (choice), To addresses (text), Cc addresses (text), Attachments (text), Unread (choice), Starred (choice)

- from_table "Priya Shah <priya@harborcapital.example>" [looked_up], from_address "priya@harborcapital.example" [looked_up], to "owner@example.com" [looked_up], cc "" [looked_up], subject "Harbor deal: restoration contractor in St. Louis" [looked_up], date "2026-10-13T09:12:00.000Z" [looked_up], labels "Inbox" [looked_up], thread "t-harbor" [looked_up], message_id "<deal-1@harbor.example>" [looked_up], direction "received" [looked_up], to_addresses "owner@example.com" [looked_up], cc_addresses "" [looked_up], attachments "" [looked_up], unread "no" [looked_up], starred "yes" [looked_up]
- from_table "Priya Shah <priya@harborcapital.example>" [looked_up], from_address "priya@harborcapital.example" [looked_up], to "owner@example.com" [looked_up], cc "" [looked_up], subject "Re: Harbor deal: NDA attached" [looked_up], date "2026-10-15T16:40:00.000Z" [looked_up], labels "Inbox" [looked_up], thread "t-harbor" [looked_up], message_id "<deal-2@harbor.example>" [looked_up], direction "received" [looked_up], to_addresses "owner@example.com" [looked_up], cc_addresses "" [looked_up], attachments "Harbor NDA.pdf" [looked_up], unread "no" [looked_up], starred "no" [looked_up]
- from_table "ListingsHub Alerts <alerts@listingshub.example>" [looked_up], from_address "alerts@listingshub.example" [looked_up], to "owner@example.com" [looked_up], cc "" [looked_up], subject "3 new listings match your search" [looked_up], date "2026-10-16T06:00:00.000Z" [looked_up], labels "Updates" [looked_up], thread "t-bbs" [looked_up], message_id "<intro@listingshub.example>" [looked_up], direction "received" [looked_up], to_addresses "owner@example.com" [looked_up], cc_addresses "" [looked_up], attachments "" [looked_up], unread "no" [looked_up], starred "no" [looked_up]
- from_table "Dana Lee <dana@leecpa.example>" [looked_up], from_address "dana@leecpa.example" [looked_up], to "owner@example.com" [looked_up], cc "" [looked_up], subject "June close for Lakeside Builders" [looked_up], date "2026-10-17T11:05:00.000Z" [looked_up], labels "Inbox" [looked_up], thread "t-cpa" [looked_up], message_id "<cpa@firm.example>" [looked_up], direction "received" [looked_up], to_addresses "owner@example.com" [looked_up], cc_addresses "" [looked_up], attachments "" [looked_up], unread "no" [looked_up], starred "no" [looked_up]
- from_table "Marco Ruiz <marco@brokerage.example>" [looked_up], from_address "marco@brokerage.example" [looked_up], to "owner@example.com" [looked_up], cc "Priya Shah <priya@harborcapital.example>" [looked_up], subject "Water damage business, $2.1M revenue" [looked_up], date "2026-10-18T14:22:00.000Z" [looked_up], labels "Inbox" [looked_up], thread "t-brokerage" [looked_up], message_id "<broker-2@brokerage.example>" [looked_up], direction "received" [looked_up], to_addresses "owner@example.com" [looked_up], cc_addresses "priya@harborcapital.example" [looked_up], attachments "" [looked_up], unread "yes" [looked_up], starred "no" [looked_up]
- from_table "Restoration Weekly <news@example.org>" [looked_up], from_address "news@example.org" [looked_up], to "owner@example.com" [looked_up], cc "" [looked_up], subject "This week in restoration" [looked_up], date "2026-10-19T07:00:00.000Z" [looked_up], labels "Promotions" [looked_up], thread "t-news" [looked_up], message_id "<news@example.org>" [looked_up], direction "received" [looked_up], to_addresses "owner@example.com" [looked_up], cc_addresses "" [looked_up], attachments "" [looked_up], unread "yes" [looked_up], starred "no" [looked_up]
