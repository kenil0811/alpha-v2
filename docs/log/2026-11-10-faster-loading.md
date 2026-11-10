# 10 November 2026: compressed answers

Kenil found Mail's 900 rows took 5 to 7 seconds to open on the server. The core builds that table in
about 30 ms; the time went in sending it, 1.7 MB a load, two thirds of it each value's source, which
repeats from row to row. The core now compresses what it sends when it is over 2 KB and the window
can read it so (brotli, or gzip where the browser asks only for that), and streams the window's own
files compressed too (`api/compress.ts`).

Checked from this Mac over the public address: Mail went from 1.7 MB in 1 to 3.6 s to 104 KB in about
0.4 s, and the window's script from 802 KB to about 230 KB. `pnpm check` green; the window loads in
WebKit as before.
