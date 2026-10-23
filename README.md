# alpha-v2

Alpha gives small businesses AI over their manual flows and legacy systems. The design is
`docs/design.md`; the working rules are `CLAUDE.md`.

## Run it

```bash
pnpm install
ALPHA_HOME="$HOME/Library/Application Support/Alpha" pnpm start
```

Open the address the core prints. It signs in with your own Claude subscription through
Claude Code's sign-in on this Mac (`claude` signed in from its default config home).

## Check it

```bash
pnpm check
pnpm journey track-what-i-eat
```

A journey runs on a fresh tenant with the real model and writes its report to `docs/journeys/`.

Every push runs the same checks on GitHub (`.github/workflows/check.yml`), plus `pnpm kit check`
on Alpha's own kit and `pnpm connector check` on every connector. A tag `v<version>` makes the
release (`.github/workflows/release.yml`): `pnpm release` with its smoke test, and the disk
image on the release page.
