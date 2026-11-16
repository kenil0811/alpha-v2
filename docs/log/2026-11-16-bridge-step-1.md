# 16 Nov 2026: the Bridge, step 1 (the pipe and a folder)

Kenil's yes to step 1 of the Bridge (doc 8QzP1AhXeHboH7UxvE6R1x): calls 1 to 4 as recommended (a
zip per computer with Node inside, signed with his key; lending by `alpha-bridge lend` on the
computer; the key in Windows' Credential Manager through its own vault; paired with his own Alpha
on the new server, Avilo's untouched), and call 5 the other way: his own Alpha made public through
Funnel too, so Windows needs no Tailscale.

- `bridge/`: the program on a person's computer. `pair <link>`, `lend` and `unlend <folder>`,
  `list`, `run`. Its key is made there, the private half in the Keychain or Credential Manager
  (each given the key on its standard input), the public half kept by Alpha. It connects outward
  over one websocket, signs Alpha's challenge, says what it lends (its own list, learnt by Alpha
  at every connect and within seconds of a change), and runs the core's own connector child.
- In the core: `computers` and `computer_links` (migration 3), a connection's `computer`, the hub
  (`core/src/bridge/`) carrying a connector process's lines over the computer's connection, the
  routes (Your computers, the pairing link, the pair, Remove, the download) and the door
  `/ws/bridge`, both reached without a session. A computer away answers at once (`away`), its
  connection waits ("Waiting for …"), with no failure and no card.
- `runs: server | computer | either` in a connector's manifest. The folder says either: on a Mac's
  own Alpha as before, on a server only lent from a computer; Alpha's own form refuses it there.
- The folder connector is its own file (`connectors/files/src/folder.ts`), so the Bridge carries
  it without the PDF and sheet readers; `bridge/pack/sdk.ts` stands in for the SDK in the zip.
- Pairing only where one person signs in (the design's call 13), until every row has an owner.
- Rules B1 (a computer acts only as its person) and B2 (what a computer lends is said on the
  computer), with their tests; A6 names the Bridge's pairing and door as reached without a session.
- `pnpm bridge pack` (rolldown, Node 26.12.0 from nodejs.org against its sums), `pnpm server
  bridge` puts the zips in the Alpha's own `bridge/` folder; Alpha hands out a zip only when Kenil's
  signature on it holds.
- To stay under the 600-line wall: the tenant's paths moved to `world/tenant.ts`, the file sources
  of mail to `connectors/carried.ts`, the computer parts of the service to `connectors/computers.ts`.
- Journey `a-computer-lends-a-folder`: a stand-in Bridge pairs, lends, a file lands; away, it
  waits; back, it catches up. Passed (report of 16 Nov 17:11).
