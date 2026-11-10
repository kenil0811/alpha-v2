# 10 November 2026: Agents, the assistant from Alpha's face, a narrower rail

Kenil's four window asks of 10 November, built on his yes:

- A conversation's steps say Failed only when the last of them failed. A step that failed along the
  way, and was got past, still says so in the list.
- Conversation is Agents in the rail, the folded rail and Find.
- The assistant's strip on the right is gone. Alpha's face sits at the right of the bar, and clicking
  it (or ⌘J) opens the assistant. It starts closed on every start of the window, stays open between
  pages once opened, and the agents' own page closes it, so it never opens again by itself (A1, A5).
- The folded rail is a 52px strip of icons, each named when hovered, now with Agents on it too. One
  sidebar button folds and opens it, as Claude Code's does (S1, S6, S10). The bar moved to `Bar.tsx`
  for the shell's wall.

Checked in WebKit on the Mac: the face opens the assistant, it stays open on Tasks, Agents closes it and
it stays closed after, a reload starts it closed, and the folded rail measures 52px.
