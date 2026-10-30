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
