# 26 October 2026: the assistant's messages

Item U1 of `proposals/2026-10-25-pending-ui-ux.md`, in `window/src/Conversation.tsx` only. The
person's sentences are accent bubbles on the right; Alpha's replies sit on the left on the surface.
Under each reply a grey line says Alpha, the module, the time and what ran ("Ran 2 steps", or what
it is doing now), with Stop while it runs. Retry shows disabled with its reason, as the core has no
route to run a turn again. The composer is round, with attach, a round send, and a microphone
disabled with its reason. Typing `@` suggests the agents from `/api/working` (arrows, Return or
Tab, Escape) and inserts `@Name `. Checked in Edge at 1100 and 1440, light and dark, folded and
open, on a stubbed stream: the dev core refuses Vite's websocket from port 4720 by its origin.
