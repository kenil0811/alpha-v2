# 26 October 2026: New module opens a page

New module, in the rail and in the folded strip, opens `#/module/new` (`NewModule.tsx`) instead of
starting the assistant's composer: a blank module with a Name (optional) and what it should keep
track of, Build it and Cancel, over an empty table. Build it sends "Make a module called <name>:
<words>" to Alpha and opens the assistant, where Alpha asks and plans; when a new module appears in
the rail the page goes to it. Escape and Cancel go back. Seen in the window from both rails, with the
say call caught so no module was made.
