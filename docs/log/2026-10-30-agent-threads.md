# 30 Oct: agents as threads, Tasks never empty

Vikas: agents are separate agents, not a filtered conversation; Alpha speaks as Alpha; cards open
their details; "Rests on" lines link; failures and repeats combine; Tasks held nothing while 22
cards waited; cards wanted a gallery. Built: Agents as a contact list with a thread each (stream
lines carry their agent and run; /api/say takes an agent), card pages in the side panel, one
"did not finish" card per module with a reason per agent, repeats folded, a newer proposal
standing for older ones, Waiting for you in Tasks, List · Card on Needs you and Waiting for you.
Agents have no model or memory of their own today: a message to one goes to Alpha marked for it.
Dell looked larger only through the browser's zoom on 127.0.0.1; its links now use localhost.

Interview me, prepared (Vikas: "the agent should be prepared … every day run the agent once to
plan what needs to be resolved"). Built: an Interviewer in Alpha's own kit (0.4.0), daily at
07:00, Run now as any agent. It calls `alpha.interview.prepare()`: code gathers what is
unresolved (the business's goals, a module's aim and its last real example, question cards
waiting, agents whose last run failed, rules noticed, tables empty, mostly blank or unchanged for
30 days, fields with no meaning) and ranks it by `interview_weights` in limits.yaml; the model
words each in the research's spine (config/interviewing.md) and may only drop what notes or
earlier answers settle. The agendas, the business's and each module's, are the run's result: no
new store. Interview me on Home and on an Overview asks the next one as Alpha ("1 of 7", why, what
it unblocks), or runs the Interviewer first and says Preparing. The person's next words are kept
as that question's answer (`answers` on the said line), the model is told to keep them in notes
(config/interview-answer.md), and code asks the next once the reply is in; an answered key never
comes back. Open for Kenil: design §11 says "no other characters"; the Interviewer is one.

**Tasks plan items 1–8** (proposals/2026-10-30-tasks-research.md; for Kenil's review). Needs you
is one list, `NeedsYou` in Waiting.tsx, drawn on Home and in Tasks (whose cut is renamed from
Waiting for you): sign-ins, then every card as its own row with its own buttons under a heading
per agent, which carries Approve all where its cards are of one kind with the same options (never
drafts), then the tasks waiting on the person that no card stands for. A proposal's tasks are a
row each with Add and Decline; the core keeps each word as a `proposed_task` line on the card and
closes the card once every task has one (`POST /api/cards/:id/tasks` takes `decline`). Card and
task rows share one subgrid with a header (state, title, state in words, module, owner, date,
buttons, the primary rightmost); narrow, three columns fold. `CardView.task` (from the call or the
run) and `createdAt` let a card say "For <task>" and a task's Review open its first card; the
task's state reads Needs your input (also in the kept tasks table, refused as a hand-set state).
The agent need line names the cards and opens Needs you filtered to that agent. Task titles,
Home's Tasks tile and gallery tiles open in the side panel; the gallery's pop-up is gone. The
29 Oct "1 of N" rule is replaced in ui-rules.md. Overview.tsx still uses `Stack`, so stack.tsx
stays. Items 9–11 not built.

**Afternoon fixes.** Charts stretch each axis on its own with a side scroll; the Strip is a
positioned layer, so a hover tile paints over later dots; repeated lines fold with ×N; buttons
hover and sit right; blocks resize in width on every arranged page. Morning no longer proposes
"Answer the N cards": each card is its own row (Alpha kit 0.4.1). A subgrid's padding sits inside
its first track, so the rows' first track is padding plus dot, and narrow rows put their buttons on
a line of their own. The Avilo demo home lives in /private/tmp, where macOS removed module files
untouched for days (Alpha's and Network's agents, their git HEAD); they were put back from
core/kits. The workspace agents (Research, Governance, Builder) are proposed in
proposals/2026-10-30-workspace-agents.md, against decision 13, for Kenil.

**Needs you as tasks, Slides, one pager.** Each waiting card is now a row of Tasks › Today, This
week and All open (core `routes/tasks.ts`: read from the cards, one row per open proposed task,
Owner You, a new From column, refused as a cell edit; counts include them). `needsCount` is the one
count for Home's tile and block, the rail's badge (sign-ins now passed to it; its hover names
modules by id, which it had been matching by name) and Tasks' cut; Tasks' Needs you leaves out tasks
waiting on someone else. The Card view writes out what a combined card asks (`bodyOf`); Slides is
a third view, one card large with `ui/pager.tsx` beside its buttons and ← →; a list heading's name
filters every view to that agent. Tables page with the same Pager. At start the runner withdraws
waiting Morning proposals whose tasks are all "Answer the N cards waiting on Home" (journal:
"Withdrawn: Morning suggests (…)"); the task Add made, k_40gydpx2da, is left for Vikas. Overview's
strip opens its links in the side panel, which now honours `?only=&why=`; a goal tile reads "of 13
this week · 1,015 listings to review" (Avilo has 1,015 deals not yet reviewed, so the old "0 of 13"
opened them all). Needs a core restart for the card rows and the withdrawal.
Rows fold state, module and owner under 64rem (at 48rem the title had 21px). Not yet seen in the
app: DealPilot's Overview, as the running core answers 500 on every module but CRM.

Resizing, minimal (Vikas, 30 Oct: the corner lines, not bars). The edge handles, grey cues and
accent bars of the morning are gone: a block resizes from its bottom-right corner alone, shown
only by the ↘↖ cursor, and keeps width and height as "key@40x320" ("key@40" still reads). A
chart's axes are held by the cursor: ↔ over the x-axis strip, ↕ over the y-axis strip, the corner
for both; double-click fits back, a focused axis takes the arrows. Bars and heat take their label
strips as axes; donut and rings have the corner alone. A click on an axis strip is the strip's.
A page's kept rows now hold a block not shown just now in its place, rather than dropping it.
Checked with Playwright on DealPilot's scatter and bars and on Home, across a reload.

**Workspace skills, not characters** (Vikas: "define it as a skill and let's ensure it's used
across multiple modules"; "only one agent"). Decision 13 is kept: Alpha's kit has Morning and Watson
as its only agents. Research, Governance, the Builder and the Interviewer are skills in
`core/kits/alpha/skills/`. The desk calls them as `research`, `governance` and `build` in any
module's thread. Any module's agent calls them through the kit API: `alpha.research`,
`alpha.governance.review`/`explain`, `alpha.builder.propose`, `alpha.interview.prepare`. Their
prompts are `config/research.md`, `governance.md` and `builder.md`, and their bounds are in
limits.yaml.
- Research only reads. It makes at most 12 searches, reads 20 pages and runs 10 minutes, through
  the browser engine. Code ranks its lines by I×R÷E and drops any line whose sources do not
  resolve.
- Governance puts each noticed rule on its own Save card, which approves that rule rather than
  making a second one. It names an agent that hits a wall in 3 runs in 7 days, and explains a
  refusal in plain words. It never approves anything itself.
- The Builder refuses a build without a business case. It researches first unless the ask is
  exact, and proposes on one card. Build it applies the changes and writes the case into
  NOTES.md. An agent may only build inside its own module.
- Interview me is dynamic. The Interviewer agent is gone: a kit update now removes a file the kit
  no longer ships, and Alpha is now 0.5.0. Morning re-ranks one pool each day. The pool holds what
  is unresolved plus a standing bank (`config/interview-bank.yaml`), and is kept in `meta`. The
  model words the top 20. A sitting asks while the next question is worth at least
  `interview_stop_value`, and stops on "done" or after a brief answer. "skip" halves a question's
  value. An answer leaves the pool for 120 days. "1 of 7" is gone: the sitting opens with "A few
  questions today, starting with the most useful."
- Tests: interview, morning and server cover the pool. skills.test covers the skills from two
  modules and the desk, with no model and no web. The proposal is rewritten as "Workspace skills"
  for Kenil.


**The standard column back on the right.** Making Overview blocks movable (29 Oct) had put every
block in one flow, two to a row, so the 27 Oct standard column was lost. The Overview is again the
work left and the standard column right, each its own arranged column with its own saved layout
(`overview:<id>:work`, `overview:<id>:side`); layouts saved under the old key are left unread.

**The strip in one row, the chart's box held.** The pulse strip (an Overview's and Home's) is now
one row of square tiles that scrolls sideways with snapping; a name wraps to three lines and the
whole of it, with the lines a tile counts, opens in a popover over the page, so the row never
clips it. The evening-out into rows from this morning is gone. A drag on a chart's y-axis now
changes only the drawing: the box keeps its height and the drawing scrolls inside it, as a wider
one scrolls sideways; the corner still changes the box, and a double-click on the y-axis fits the
drawing back to it (Vikas, 30 Oct).

**Across the two columns.** `Arranged` takes columns: each column is saved as its own page, so a
block moves within or across the work and standard columns and keeps its size; the old two-page
layouts read as the columns. Narrow, the columns stack, work first.

**Lists dropdown and choice colours.** Vikas saw the list's actions in the "All" dropdown and the
lists themselves in a row under the toolbar. The dropdown (`table/ViewTabs.tsx`) now holds All,
the saved lists and the values of the table's list choice (Clients, Insurers, Leads, My team) with
counts, search past six and Add new…; Rename, Duplicate, Open the table on this list and Delete
moved to a right-click of the dropdown or of a list's line, and the row under the toolbar is gone
in every table (Tasks' own due cuts stay). Every choice now has a stable colour: the field's tone,
else `--opt-1…8` (new tokens in `app.css`, light and dark, all 4.5:1 or more) by its place among
the field's choices, through one helper (`optionClass` and `Choice` in `ui/pill.tsx`) used by grid
cells, tag chips, cards, the row page, every choice `Select`, the tag picker, the filter's value
list and the lists dropdown. Rules under "Lists dropdown and choice colours (Vikas, 30 Oct)" in
`docs/ui-rules.md`, waiting on Kenil.

**The Interviewer under Agents, Stop while preparing, New agent in sight** (Vikas: "Interview me
should take me to the Agents page with one of the agents named Interviewer"; "while it is loading
there is no way for me to cancel"; "I still don't see a New agent option"). Decision 13 holds in
code: the Interviewer is no kit agent but a fixed thread id, `interviewer`, which the core puts on
the sitting's lines (its "iv…" turns, what the person says in it, Alpha's replies to that) and
accepts as `agent` on `/api/say`. Only words said in that thread answer a pending question. Interview
me on Home and on each Overview opens `#/conversation/interviewer` and starts the sitting there,
scoped to the module; while the pool is ranked the thread says "Interviewer Preparing…" with Stop,
which stops the window's polling and posts `/api/interview/stop`, so the thread says "Stopped.".
The ranking's one model call has no abort and finishes in the background (the day's pool). On an
Overview, Interview me is now a small square at the head of the standard column, not beside the
strip. New agent sits atop the Agents list and as a line at the foot of a module's Agents card
(`#/agent/new?module=<id>` chooses that module). Checked with Playwright on Avilo, the preparing
state stood in, since the running core predates the change; needs a core restart.

Lists, double-click and editable cells (Vikas, 30 Oct). Dell's Intake: Contact and Prior contact
are toned choices, which a row's page (and the side panel, which draws it) shows only as the states
under the title, and those pills changed nothing; a double-click on one now opens the choice's
dropdown. The core refused a relation or a person from the window ("set by asking Alpha"); it now
takes a pick, checked against the relation's table or the person's people, and the window picks
from those rows (Attorney lists My team); `FieldView.relatesTo` says which table. A summary, a file
or a list of rows stays fixed, and a double-click says why in the tip. Governance's columns and
How to work are one list control (`ui/entry-list.tsx`): New when empty, Add on the heading, ✕ on a
hover (asked first), a double-click to change an entry's words, which go to Alpha since a rule is
made only on its card. A task's title and notes no longer edit on a click: a double-click, as a
row's title (`ui/title.tsx`) and notes do. The side panel has a firmer edge and a soft shadow. Core
test in `api/rows.test.ts`. The running cores predate the relation and person change: restart them.

Strip tiles and Update now (Vikas, 30 Oct). Every strip tile, on an Overview and on Home, is one
layout: the number big and left with its words after it ("0 listings reviewed · of 13 this week"),
a number of four characters or more ("1,016") on its own line above them, a spark under the words,
and one button at the foot carrying the signal as a small dot before its words; the dot beside the
tile's name is gone, and so is the name, which the words now say. Every tile has its button: with
nothing to do it stays greyed and says it is done ("All engaged", "Nothing new"), its hover saying
why. 200px square, the least size at which the common tiles show whole (180 cut "Review 1,016
new"). The row is keyed by its tiles, since a snapping row kept to the tile it first snapped to and
opened scrolled past the first. Sync now (an agent group's line and a table's readers), Insights'
Look again and an agent page's Run now are one `UpdateNow` (`ui/update-now.tsx`): "Updated 12:42"
just before the button, Updating… and a turning icon while it runs; Insights' date at its foot is
gone, and an agent group's button sits under its bar so the name keeps its room. Checked with
Playwright on Avilo (DealPilot's Overview and Home).
