# 25 Nov 2026: a mic on every chat box

Vikas asked for voice input on every place where you chat with Alpha.

- `ui/mic.tsx` is one mic button. It uses the browser's own speech to text, so nothing new is
  installed.
  - Clicking it starts listening, and the words appear in the box after what is already typed.
  - A second click, or the browser hearing the end, stops it. Nothing is sent until Send is pressed.
  - A browser with no voice input shows the button disabled, with the reason.
- The mic sits beside Send in the shared chat box (`Composer.tsx`), which is used by the assistant,
  agents and tasks. It sits beside Import on New module.
- The New list page on `claude/table-dashboard` gets the mic when that branch comes in.
- I checked it in the app with a stand-in for the browser's recognition: the heard words land after
  typed ones, and a second click stops it. Real speech wasn't tested, because the preview can't use
  a mic.
