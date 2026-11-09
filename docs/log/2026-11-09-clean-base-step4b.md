# 9 November 2026: the clean base, step 4b, a sign-in per person

Kenil's calls (doc https://claude.ai/artifact/HCqSvWQPEhiNPZMxzhz97M), as recommended: only the owner
sets the model and the data, adds people and installs a signed pack; no second factor yet; a sign-in
lasts 30 days (`session_days`).

- `sign_in: true` in `alpha.yaml` makes Alpha ask. A Mac install keeps the per-install token and shows
  none of this. `accounts` and `sessions` are in `schema.sql`; `world/accounts.ts` holds passwords as
  scrypt hashes, links and sessions as hashes of what the browser has. The model's SQL opens no view
  on them.
- Every request knows its person: the api's `user` reads the request it is used in
  (AsyncLocalStorage), so the routes did not change. A desk keeps a plain copy, as it outlives requests.
- The sign-in page, the page behind a one-time link, Settings › People (owner only; Alpha sends no mail,
  so the owner passes the link on), Sign out at Settings' foot. Microsoft sign-in works for an email
  the owner added, on the firm's own sign-in app.
- Live updates: a change to the world reaches every window, a person's streaming reply only theirs. A
  card's every route checks it is theirs.
- The local command says `x-alpha-cli` with the token and acts as the owner; the token alone no longer
  opens anything on an Alpha that asks.
- Rule A6, in `core/src/rules/access.test.ts`.
- Not tried against a real tenant: Microsoft sign-in is tested on the made-up provider of the sign-in
  tests. Real hosting is step 9.
