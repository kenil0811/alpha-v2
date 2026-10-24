# 24 October 2026: the problems list, step A (items 1 to 6)

From the review https://claude.ai/artifact/UT8qRdXRNAhMVd8TSCdgLM of Vikas's problems list;
Kenil's word 20:39 UTC ("lets start with these fixes"), on a branch (`safety-fixes`, a worktree
beside the repo) so the running prompt measurement was not touched; the history rewrite for item
8 dropped on his word 20:38 ("leave the commits").

1. **Websites controlling a running Alpha** (`api/server.ts`): the token, Host and Origin check
   went by the raw address, and Fastify decodes `%61` before routing, so `/%61pi/me` was
   `/api/me` unchecked. The check now goes by the route reached (`req.routeOptions.url`) and
   the decoded path; a test tries `/%61pi/me`, `/%77s`, `/api/%6de` and a POST to
   `/%61pi/kits/pack`.
2. **A tampered pack emptying a folder** (`modules/packs.ts`): a pack's version was joined into
   a path and that folder removed. A version must be `1.2.3`, the name must have a letter, both
   checked before any folder is touched; a link inside a pack is refused. Tests with a version
   of `../../Documents` (the folder untouched) and a packed symlink.
3. **An emailed attachment running as Alpha** (`api/routes/files.ts`): a stored file was served
   inline with the type its sender gave. PDF, images, text, CSV and Markdown show inline; HTML,
   SVG and XHTML under `Content-Security-Policy: sandbox` with no referrer; everything else
   downloads; `X-Content-Type-Options: nosniff` on every file. A test for each kind.
4. **A module page sending its figures out** (`window/index.html`): `frame-src 'self'` on the
   window, so a page's frame cannot navigate itself elsewhere; a `srcdoc` frame still loads.
5. **A module page speaking for the owner** (`window/src/PageView.tsx`): a page's `say` no
   longer posts to the desk by itself; the window shows "This page asks Alpha: …" above the
   frame with Not now and Ask Alpha, and sends only on that button.
6. **A Gmail hiccup shutting Alpha down** (`connectors/gmail/src/index.ts`): `withImapClient`
   listens for the client's `error` and fails that call with it; the core's restart stays the
   backstop. A test with a stand-in client that drops mid-call.

Item 8, the files only: the client's figures moved from `docs/log/2026-10-20-accounting.md` to
alpha-avilo's log; the two comments that named a client's domain use an invented one.

Found while checking the fixes on Kenil's Alpha (its log): a start that had orphan runs to end
crashed on `ReferenceError: Cannot access 'engine' before initialization` (the runner's `notify`
in `main.ts` reached the engine, made after the runner; `endOrphans` runs in the runner's
constructor since 23 Oct) and restarted itself until the orphans were gone, eight times today.
`notify` now tells the engine only once it exists.
