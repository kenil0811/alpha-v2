# 29 October 2026: packs signed by Kenil, and the developer switch

Step 2, part 1, slice 3, on Kenil's "yes" to its detail (20:39).

- `core/src/signing.ts`: Ed25519 over a pack's PACK.json (its files and their hashes), SIGNATURE
  beside it; the trusted key is `core/config/signing-key.pub` (none until Kenil runs
  `pnpm sign --new-key`, so until then only the developer switch lets a pack in); the developer
  switch is a preference in the world (`developer`), off on a fresh install.
- `pnpm sign --new-key [--offline <file>]` makes the key (private in the Keychain, "Alpha signing
  key"; public into the repository); `pnpm sign <pack>` signs a kit or a connector pack. The
  release signs every pack it builds, and its smoke test turns the switch on in its throwaway core.
- Kit packs: installed from a file or kits/inbox only signed, or with the switch on; from a
  folder, or updated from one, only with the switch on. Once in, a kit's module is the person's
  (ownership rule), so it is not checked again: the detail said installed packs are rechecked at
  every start, which holds for connectors only.
- Connector packs: from a file or the release's offered packs only signed, or with the switch on;
  from a folder only with the switch on. An installed connector keeps `.pack/PACK.json` and
  `SIGNATURE` and is checked at every start: a file changed, added or gone stops it loading, said
  on Home with the file.
- Settings › Experimental always shows (UI rule I2 changed), the developer switch at its top.
- Tests: `signing.test.ts` (signed loads; unsigned or another key refused unless the switch is on;
  a byte changed in a file or in its list refused; an installed connector changed afterwards stops
  loading), failing before. The existing pack tests run with the switch on.
