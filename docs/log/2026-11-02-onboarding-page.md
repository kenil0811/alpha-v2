# 2 November 2026: onboarding in Alpha, its page and Home row

Kenil's yes of 14:06 to onboarding's own page in Alpha (steps 5 and 6 of the design as one), with
two calls: the one-at-a-time cards are needed before onboarding is shared with anyone, so they come
straight after; and the window's pieces are to be shared, never made again per screen.

- The window gained one seam for plugins: at build it finds `plugins/*/window/index.tsx` and gives
  each `screen` its page (`#/p/<name>`, its title in the bar) and, while something of it waits,
  a row on Home. A plugin's screen imports only `@alpha/window/kit`: the window's own buttons,
  fields, card shell, list rows, groups, sections, pills, the shared question, the act hook, its
  own routes, opening a module or a connection, and the assistant's box. The look and word tests
  now read the plugins' screens too; Tailwind reads their classes from where they live.
- The question is one shared piece (`window/src/ui/question.tsx`): a card's question and
  onboarding's use the same one; a list row can show a whole sentence (`wrap`).
- The plugin: Home's row (start, looking, or what waits), the sources Start lists (the catalogue
  now says which connectors are this computer's own, never suggested), Add and Decline on a
  suggestion or a routine; what was declined and the questions answered are kept apart from the
  runs, so Forget keeps the person's word, and a later look never offers them again. The run's shape
  moved to `src/run.ts` so the page reads it typed.
- The page (`plugins/onboarding/window/`): what Alpha reads and Start; Looking with the time so far;
  About you (Keep, Edit, Drop); Questions (each answer becomes the person's own line); Routines
  (Set it up puts the words in the assistant's box); Suggestions (Add opens the module or the
  connection, or puts a build or a reminder in the assistant's box; Decline); What was sent, each
  look in plain words, and Forget; Look again.
- Looked at on Kenil's Alpha in WebKit with his first look's results, only reads reaching the core.
