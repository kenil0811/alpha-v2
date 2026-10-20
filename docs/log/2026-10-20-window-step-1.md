# 20 October 2026: the window redesign, steps 1 and 2 (Ledger's look and its parts)

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

## Step 2: the parts (uncommitted, for Kenil's review)

Kenil said yes; step 1 was committed and pushed (c640718..0f7053a). Step 2 built the window's
parts in `window/src/ui/`, from the mock's direction A: Button (plain, primary, ghost, warn; two
sizes) and IconButton; Pill (states only in green, amber, red), Topic chip, Label (the one
uppercase), Kbd; Segmented; Switch; Field and Select; List, Row and Tile; the Card shell (a sunk
head naming the gate, "Waits for you"); the Side panel (320px, right); Section. Icons are
lucide-react 1.59. The label tracking became a token.

The screens use them: Settings (connections and folders as rows with state pills, forms on
fields), Kits and agents (a switch per agent), Home (the gate card on the shell, run lines with
Open and Pass, the work fold, the composer with its send button), Activity (one list, state
pills, 24-hour times), tables (Table · Board as a segmented control, a value's kind as a pill).
Layout is otherwise as it was: the shell, Home's anatomy, the source panel's place and Activity
by day are steps 3 to 6. A Parts page (`#/parts`, not in the rail) shows every part, and the
shots take it, so a part is seen in light and dark before a screen uses it.
