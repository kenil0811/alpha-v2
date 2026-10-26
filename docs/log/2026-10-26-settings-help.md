# 26 October 2026: Settings › Help

Asked by Vikas. Settings has a last section, Help: the keyboard shortcuts the window really has,
grouped by where they work (anywhere, Find, writing to Alpha, tables, a panel's edge), each read
from its handler in `App.tsx`, `Shell.tsx`, `table/Grid.tsx`, the composers, `Mark.tsx` and
`ui/edge.tsx`; and the version, from the core's `/api/health`. The table has no arrow-key moves
or copy and paste yet, so Help does not list them. Window only. Checked with biome, tsc, vitest
and in Edge at 1400×1300.
