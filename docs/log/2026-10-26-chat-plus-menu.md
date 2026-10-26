# 26 October 2026: the composer's + menu

In `window/src/Conversation.tsx`, the paperclip becomes "+": Add files or images, Add a folder
(every file in it goes up), Model › the three routes from `/api/model` with the chosen one ticked,
and Speak, moved in from the composer, still disabled with its reason. A route that needs a key
with none kept is disabled, "Needs an API key: Settings › Model" on hover. Off the subscription, a
chip beside "+" names the route and opens Model. The menu's first line takes the focus; arrows
move, Escape closes and gives the focus back to "+". `MenuItem` takes a `title`. Checked in Edge
on Vite at 4755 against the dev core, with the route's POST stubbed so the install kept its own.
The core has no per-message model and no model per route: asked of Kenil in PR.
