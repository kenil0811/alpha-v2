# 30 October 2026: signing in as the person, with Microsoft (step 2, part 5, slice 1)

Step 2 of the final plan, part 5, slice 1, on Kenil's "makes sense to me" (14:55) to signing in as
the person (delegated) rather than with an app's key; his test tenant is bridge08.onmicrosoft.com.

- `connector-sdk/src/signin.ts`: a provider (Microsoft) says its sign-in and token addresses for
  the client's own app, the permissions IT approves at once (read, drafts, send), the setup sheet,
  and what its error codes mean. A manifest signs in as the person with `auth: 'oauth'` and
  `oauth: {provider, scopes}`; the SDK's check refuses a provider it does not know and a scope the
  sheet does not have IT approve.
- `core/src/connectors/signin.ts`: the organisation's sign-in app in `meta` (journaled), the
  provider's page with a one-time state and PKCE, the answer traded, the long-lived token in the
  secret store and kept out of the journal (`keepOut`, and `letGo` for a renewed short-lived one),
  one renewal at a time, `forget` on Read now. The connector service gives an oauth connector the
  short-lived token as `host.secret()`; `connect` leaves it needing a sign-in; `checkNow` connects
  it once the check holds; `failed` sets a state from a sign-in that came back with no.
- Routes: `GET /api/sign-in/back` (no token, Host still checked; a page saying the outcome),
  `POST /api/sign-in-apps/:provider`, the sign-in route opening the page (`Platform.openLink`),
  Read now on a connector with nothing to read checks it. Connections' view has `signInApps` and
  each connection's `signsInWith`; Home's Needs you opens the page.
- Window: Intelligence › Connections › Sign-in apps (the sheet, its values to copy, the two ids);
  a connector tile that signs in as the person says Sign in with Microsoft, and says to set up
  the app first when it is not; "Needs you to sign in" (was "… again").
- Outlook connector (`connectors/outlook`), slice 1: its check asks Graph who signed in and wants
  the connection's own address. Reading mail is slice 2.
- Tests: nine on a made-up sign-in service on this computer (never a real tenant), five failing
  first; the return page let through without the token from this computer only.
- On the way: the desk's tool entries and the start layer's words moved to `connectors/served.ts`,
  as `service.ts` passed its wall.

## Slice 2: Outlook reads mail

Pushed slice 1 at 15:31 on Kenil's "yes this worked" (he connected kenil@bridge08 as its admin);
he asked for reading, which is this slice.

- `connectors/outlook`: Inbox and Sent Items into Mail with Gmail's fields (the first read 90 days
  back by `receivedDateTime ge`, then Graph's delta per folder, the delta addresses as the cursor;
  removed messages not landed), the attachments' names twenty messages to a `$batch`, the folders'
  counts for the health judgement; `search` (Graph's `$search`), `read` (by `internetMessageId`,
  as text), `files` (file attachments only). Every ten minutes. Five tests on made-up Graph
  answers, four failing first; journey `outlook-on-recorded-answers` (`journeys/fixtures/outlook`).
- Mail's files with two accounts in one table: intake asked every connection about every row (each
  failing on the other's). `records.landed` now says which connection landed a row (its
  provenance) and each file source carries its connector and account; a test failed first.

## Slice 3 dropped; part 5 and the connector platform step closed

Slice 2 pushed at 15:57 on Kenil's "looks good" (his Gmail email landed through Outlook and
Alpha answered from it). Slice 3, an app's own key (a certificate made by Alpha, Exchange's
per-mailbox app permissions), was written up; Kenil asked why it is needed at all, and on his
"yes" (16:52) it is not built: background reading already works with the person's own sign-in,
Dell's people each sign in, and a shared mailbox can be read through a person who has it. The
design says when it would be built. Step 2 of the final plan, the connector platform, is done.
