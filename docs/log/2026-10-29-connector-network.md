# 29 October 2026: each connector reaches only the hosts it names

Step 2, part 1, slice 2, on Kenil's "yes" to its detail (18:00).

- **Tried first:** the sandbox's per-process allow lists (registered under an unguessable id the
  proxy reads from its username); its proxy runs in the core's process, so nothing may block the
  core's event loop. Node's fetch takes the proxy with `NODE_USE_ENV_PROXY=1` and `NO_PROXY`
  cleared; a direct connection is refused by the sandbox itself. imapflow and nodemailer reached
  Gmail through it; Yahoo was refused and recorded.
- **One sandbox** (`core/src/sandbox.ts`) for scripts and connectors: nothing allowed for everyone
  (`strictAllowlist` off, as per-process lists need), so a script, given no list, still reaches
  nothing (`scripts/run.test.ts` holds it).
- **Connectors:** manifest `reaches` (Gmail's IMAP and SMTP, LinkedIn's site) and `chosenSites`;
  connections keep the person's approved hosts (migration 26, `connections.hosts`, Allow from a
  refusal, only for `chosenSites`). Each process is wrapped by the sandbox with its own id: reads
  Alpha's code, its own folder and (Files) its connections' folders, restarting when they change;
  writes only tmp; env with no secret. The list is given again before every call. The browser it
  asks for opens only its hosts; the Mac helper is run by the core (`host.helper`).
- **Refusals listed:** a `reach_refused` line per refused host, under the connection in
  Intelligence › Connections with "In its own sandbox. Reaches …" (connections' contract moved to
  `api/connector-types.ts`, as `types.ts` was at its wall), and as a step of the read in Activity.
- **Journey** `connector-reaches`: a made-up connector names the made-up site by one name and reads
  it by that name (reached) and by another (refused, listed). Failed before. Tests: the browser held
  to a connector's hosts, an approved host joins them, host patterns.
- **On his Alpha:** four connector processes, each with the sandbox's proxy in its environment and
  no secret of the core's; Gmail read through it at 18:30. His LinkedIn (1.1.0, added) named no
  hosts, so its browser would have been refused: LinkedIn 1.2.0 carries `reaches`, and Alpha's own
  update brought it in at start.
