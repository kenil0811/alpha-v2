# 26 October 2026: section headings at 27px

Section and card headings were 14 to 21px, under the 18px body. One more size in `app.css`,
`text-heading` (27px, body × 1.5), named for what it is rather than `3xl`, which would sit below
`2xl`; `look.test.ts` now counts eight sizes. Used by the module sections, `ui/section.tsx`
(Settings, Tasks, People's pages) and `ui/groups.tsx` (Home and the side panel). Page titles and
the bar title stay. Checked in Edge at 1440×900, light and dark: Home, a Network table, Settings.
