# 20 October 2026: the window redesign, step 1 (Ledger's look)

Kenil tested DealPilot on a test copy ("looks good!") and stages A and B were committed and
pushed (alpha-v2 3937316..9cbabb6; alpha-avilo private at github.com/kenil0811/alpha-avilo). He
picked direction A, "Ledger", for the window (the design thread's proposal and mock) and said yes
to step 1 of its order of work.

## Built (uncommitted, for Kenil's review)

- **Tokens:** the proposal's `tokens.css` is `window/src/app.css`. Slate neutrals leaning to one
  slate-blue accent; green, amber and red only for states; seven text sizes (11 to 26px); light
  and dark by the Mac's setting, or `data-theme` once Settings › Appearance sets it (step 7).
  Tailwind's own palette and sizes are off.
- **Fonts, bundled:** Geist, Geist Mono and Source Serif 4 (titles only) from Fontsource 5.3.
- **Every screen on the tokens:** about 160 classes in 9 files moved by one mapping (greys to
  ink, line, sunk and hover; red and amber to bad and warn; the rail to its own tokens; the
  primary button to the accent). Sizes kept their pixels (old 12px is `text-sm`, 14px is
  `text-base`); steps 2 and 3 restyle the parts and the shell.
- **The guard:** `window/src/look.test.ts` fails any colour of Tailwind's palette, any invented
  text size or colour (`text-[15px]`, `border-[#fff]`) and any colour written out, with file and
  line. Checked on a planted offender.
- **`pnpm shots "<address>"`:** every screen (Home, Activity, Settings, each table and its board)
  in light and dark at 1440×900 and 1024×700, in WebKit (79 MB, once, in `.data/browsers`), into
  `.data/shots/<time>/`. Each screen loads fresh; opening another table now opens it as a table.

## Seen

36 shots of the test copy, which Kenil had used: he added POE Advisors, a real source, and its
46 listings came in. Light and dark both read; tables, the board, Settings and Activity keep
their layout in the new palette and type.

Noticed in his run, for DealPilot later: some POE listings say Acquisition Pending or On Hold on
the site and are kept as Listed, since the reader does not read a listing's status yet.
