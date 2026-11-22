# Alpha's rules for modules and data

These are the rules the core keeps on who may change a module, who owns the data, what the
journal proves and what must fail loudly. Each rule is one line, as agreed with Kenil. Read this
before any change to the core's world, its routes or tools, a schedule's scripts, a connector's
tables or a plugin. A rule lands here, with its date, once Kenil has said yes to it. Where this
list and `docs/design.md` disagree, the design wins and this list is corrected the same day.

**Held by** says how the rule is held:

- **test**: its test in `core/src/rules/` tries it through every door and passes.
- **skip (what it waits on)**: the test is written, and what does not hold yet waits on what is
  named. A waiting door that starts to hold fails until its mark is taken off, in the test and here.
- **with Dell's contract**: written when the work for Dell's contract starts.
- **—**: code cannot check it, so review holds it.

`pnpm rules` checks this list against the tests. Dates are 2026.

## Terms

- **Open module**: the firm's to change, within its build setting.
- **Managed module**: changed only by a newer pack signed by Kenil's key. A plugin's module is
  managed by Alpha, and a connector's module for its source fields.
- **Alpha's own table**: Alpha's row is the firm's working record.
- **Mirror**: a table of a system that keeps the record. Its connector names that system.
- **Source field**: a field on a mirror that the connector fills. **Own field**: any other
  field on it.
- **The person's value**: a value a person typed, or that the model wrote on their own words.
- **Correction**: the person's value on a mirror's source field. It is kept in Alpha and never
  sent back.
- **Door**: any way in that can change a row or a module. All of them are listed in
  `core/src/rules/doors.ts`.

## Who may change a module

| # | Rule | Date | Held by |
|---|---|---|---|
| M1 | Every module is open or managed. Only a pack signed by Kenil's key makes one managed (`managed: true` in its module.yaml). A plugin's module is managed by Alpha itself, and a connector's module for its source fields (the firm's own fields beside them stay the firm's, D7) | 4 Nov, 5 Nov | test |
| M2 | In a managed module nobody changes its tables, fields, choices, relations, schedules, skills, scripts, pages or business case: not a person, the model, a schedule or a plugin. Every door refuses in words that say who manages it; the window greys the control with that reason. A connector that comes with a plugin makes its own mirror tables in the plugin's module, as the plugin's kit does. What a person adds to People and Organizations (their +) is theirs: two tables in Alpha's own People module, People details and Organization details, marked by lasting keys, which only the person makes and adds fields to; nothing else in a managed module, never Alpha's tool or a kit, and a connection's field there stays its connector's | 4 Nov, 20 Nov, 22 Nov | skip (Dell's contract) |
| M3 | Only a newer signed pack changes a managed module. Its files are checked against the signature at every start; a changed file does not load and says what changed | 4 Nov | test |
| M4 | In an open module everything is the firm's to change. A kit's update follows the ownership rule, and a maintained kit's shape change, or a change to a file it shipped, goes on its card from every door, not only the model's tool; a file the firm adds to its module (a source's own reader) is the firm's. A fix the person asked for needs no second yes: a data file the kit shipped (a reader, a list a script reads), changed in the turn the person asked in, is kept without the card and counted as a change the maintainer has not seen; the same holds for a list of choices the person asks to change (a new stage, a renamed one, a new order); a script, a schedule, a skill's words, the notes, a page and every other change of shape (a table, a field) still go on the card | 4 Nov, 5 Nov, 15 Nov | test |
| M5 | Kit code finds tables and fields by their lasting key, never by a name a person can change, so a rename never breaks a schedule or a reader | 4 Nov | test |
| M6 | Who may build is one firm setting: everyone, admins or nobody. Building is a new module, table, field, schedule or page, and installing or packing a kit | 4 Nov | with Dell's contract |
| M7 | The developer switch (`developer: true` in alpha.yaml, out of the window since 7 Nov), installing packs, restoring, bringing in or removing data are for admins only (the owner, until there are users); the model's route is everyone's to set | 4 Nov, 7 Nov, 19 Nov | with Dell's contract |
| M8 | A managed kit's update may rename, retype and remove, by a scripted migration signed with it; an open kit's update only adds | 4 Nov | with Dell's contract |

## Who owns the data: Alpha's own

| # | Rule | Date | Held by |
|---|---|---|---|
| D1 | Every table is Alpha's own or a mirror. A mirror names the system that keeps its record; a field its connector does not fill is Alpha's own | 4 Nov | test |
| D2 | The person's value beats every machine. No reader, connector, script, schedule, revert of a machine's run, or the model on its own writes over it or clears it; the model changes it only in a turn on the person's own words | 4 Nov | test |
| D3 | A machine's newer value for a field the person set is kept beside theirs, with its source and time. The cell is marked ("the page now says …") and Reset puts the source's value back | 4 Nov | test |
| D4 | A row the person removed stays removed: its item key is remembered, so a reader that meets it again leaves it out. Bring back returns it | 4 Nov | test |
| D5 | A number, an amount or a date the model calls "stated" must be in the person's message or a card's answer; otherwise it lands as assumed | 4 Nov | test |

## Who owns the data: mirrors

| # | Rule | Date | Held by |
|---|---|---|---|
| D6 | A mirror's source field takes a correction kept in Alpha, never sent back. The corrected value is what Alpha shows and uses, marked "Corrected in Alpha; Gmail says …"; each read keeps the source's value beside it, and Reset puts it back. A field the connector declares writable is the exception (D10). In a managed module the kit decides whether corrections are allowed. An action that leaves the world on a corrected value uses the correction, and its card says so | 4 Nov | skip (Dell's contract) |
| D7 | Alpha's own fields may sit beside the source's on a mirror's row (tags, notes, a link to a deal) and follow the rules for Alpha's own data | 4 Nov | test |
| D8 | A mirror's rows come and go only with the source: no remove, trash, Bring back or Revert of them in Alpha. A record deleted at the source is marked gone and kept, out of the default lists, so the notes, tasks and links on it stay findable | 4 Nov | test |
| D9 | Each mirror's connector declares what may change at the source (add, change which fields, remove), each through one named action. What it does not declare is never sent; mail, calendar, contacts and LinkedIn declare nothing | 4 Nov | test |
| D10 | A change to a declared field is a request, not a write. It goes through the declared action as a step that leaves the world (`outward`, never `write`), on a card unless an approved rule allows it. It carries the value it was based on, and is refused when the record changed since | 4 Nov | skip (Dell's contract) |
| D11 | The row shows the request as waiting until a read shows the system took it; only then is it the row's value. Not confirmed in time, it becomes a card. Each step is a journal line | 4 Nov | with Dell's contract |
| D12 | A mirror's row says when it was last read; an action that leaves the world on a mirror's value reads that row fresh first | 4 Nov | skip (Dell's contract) |
| D13 | A guess the person turned down (✕ on a grey value, which empties it) is never written back: an estimate or an assumption of the same value in the same field of the same row is refused, by every door that guesses; a different value, or the person's own, is not. What was turned down goes with its row to the trash and comes back with it | 22 Nov | test |

## Who may change an agent

| # | Rule | Date | Held by |
|---|---|---|---|
| G1 | An agent that shipped, Alpha's own or a kit's, changes only with its source. No one changes its instructions, title, description, skills or schedules in place: not the model, another agent, itself or a person. Each refuses in words that name the source | 11 Nov | test |
| G2 | An update never touches an agent's memories, conversations, the files it kept itself or the model the person picked, and a shipped agent the firm deleted stays deleted | 11 Nov | test |

## What leaves

| # | Rule | Date | Held by |
|---|---|---|---|
| L1 | Agents and their scripts open any website with no card, through every way out (WebFetch, look, the shell, a script), and a deny rule closes a site. Where the owner turns on asking before new sites, an address opens with no card only when it was shown in the conversation (the person's message, or a page, a search or a connector's read, never something the agent wrote itself) or its site is on the agent's list or named by the person; any other goes to the leaves-your-world gate, and a yes puts the site on the agent's list for good | 11 Nov | test |
| L2 | A browse step that puts something into a site asks first: typing, choosing, a key that types, Enter where text goes or in a form, and a button that sends to other people (Share, Publish, Post). It asks once for the agent, the site and the piece of work (the task, or the person's one request), and the yes holds for that work within its hours; three such yeses in a row offer Always, which is one agent's on one site and the person's own. A step whose button or dialog cannot be taken back (pay, buy, order, transfer, send, sign, delete for good) asks every time, under a yes and under Always. Reading, moving around and every other click ask nothing; a deny rule on the site refuses with no card. Code decides which a step is before it runs, from the action and the element; the words are `core/config/words.yaml` | 13 Nov | test |
| L3 | A browse step opens only the profiles of the person its work is for, or the firm's: one person's sign-in to a site is never another's. Only that person may watch the page their work is on or take it over; while they have it, no step of the agent's reaches it, and the record keeps that they had it and for how long, never what they did | 13 Nov | test |

## A person's computer

| # | Rule | Date | Held by |
|---|---|---|---|
| B1 | A computer acts only as its person. A connection on a person's computer (the Bridge) is theirs: their own turns (their conversation, the tasks they give) and the scripts run for them may use it; another person's turn and a script run for the firm or for someone else are refused, in words that name the computer | 16 Nov | test |
| B2 | What a computer lends is said on the computer. A folder there is lent in the Bridge, never named in Alpha; a site is lent only once its person signed in to it there, in a window nothing drives, with the Browser switch on; the Bridge refuses any call for what it does not lend, whatever Alpha sends | 16 Nov, 17 Nov | test |

## What is never kept

| # | Rule | Date | Held by |
|---|---|---|---|
| N1 | The never-use list applies as things are read: a row or a file holding one of its words never lands, from any connection. The list is the one Alpha ships (`core/config/never.yaml`), the same for every connection, changed there alone and never shown in Alpha. A connection on a person's computer leaves a match out in its own process there, before it leaves the computer, and the core leaves it out again as it lands. Each connection says how many its last read left out, never which | 18 Nov, 19 Nov | test |

## Interviews

| # | Rule | Date | Held by |
|---|---|---|---|
| I1 | Every line, workflow, step and proposal the Interviewer proposes cites what it rests on (a row read, the person's answer, a page, a file, a line of what they did in Alpha), and only that: one that cites nothing, cites what nothing read holds, names a site or file nothing read holds, or says "you said" of words not in the answers it cites is refused | 19 Nov | test |
| I2 | The report's numbers come from code: how often from the rows that are each one time, counted over the days read; how long from the person's answer; hours a month from the two. Where one is not to hand it may be estimated, and is kept as estimated with what it rests on, as are the hours it makes | 19 Nov | test |
| I3 | A source the person skipped is never read and never cited, and sources are put to them one card at a time | 19 Nov | test |
| I4 | A line the person dropped, or a proposal they declined, is never proposed again in the same words | 19 Nov | test |

## Plugins

| # | Rule | Date | Held by |
|---|---|---|---|
| P1 | A plugin loads only where the Alpha's alpha.yaml names it (`plugins: [interviews]`), set per Alpha shipped and never in the window: one not named adds no agent, tool, route, schedule, row or screen. One switched off after use keeps what it made (its module and rows, the lines kept in How to work) while its agents and schedules are hidden and do not run; switched on again, it carries on where it was | 19 Nov | test |
| P2 | A plugin works through an agent its kit carries: the tools it gives are that agent's alone, a conversation it starts is in that agent's chat for the person who asked, and lines it proposes for How to work are put to the person on a card, written there as theirs only on their Keep (For everyone here only by the owner) | 19 Nov | test |

## Audit

| # | Rule | Date | Held by |
|---|---|---|---|
| A1 | One journal line per change, written in the change's own transaction by the world function that makes it; no door writes a line of its own beside it | 4 Nov | test |
| A2 | Every line names a real actor: the signed-in person, a schedule with its run, a connector with its account, or Alpha's turn with the message it served | 4 Nov | with Dell's contract |
| A3 | The chain's newest hash is written outside the world every day, in a manifest beside the daily backup, so a rewritten tail cannot verify | 4 Nov, 10 Nov | test |
| A4 | A line that adds, changes or lands rows carries a digest of the values it wrote, so `pnpm journal verify` finds a value changed in the file | 4 Nov | test |
| A5 | In a firm with users, reading a managed module's records is a journal line, folded after its days like the model's reads | 4 Nov | with Dell's contract |
| A6 | Where Alpha asks people to sign in, every request but the sign-in pages and the Bridge's pairing, door and updates (proved by the link's one-time code, the computer's own key, and the signatures on what it fetches) carries a live session and acts as that person: their conversation and the cards raised in it are theirs alone, and only the owner sets the data, who may sign in, the workspace's name and picture (one for the whole Alpha), and installs a pack, in Settings and in Set up Alpha alike; a member sets the model as the owner does, journaled as theirs | 9 Nov, 19 Nov, 22 Nov | test |

## Reliability

| # | Rule | Date | Held by |
|---|---|---|---|
| R1 | Every scheduled job that fails says so: a journal line each time, and a card on Home after two failures in a row, closing itself when the job next works | 4 Nov, 10 Nov | test |
| R2 | A daily backup that failed is a card the same day | 4 Nov, 10 Nov | test |
| R3 | Each rule here says how it is held; its test tries it through every door, and `pnpm check` fails when a rule and its test disagree | 4 Nov | test |
| R4 | The scenario journeys that do not wait run before any push that touches the world, and the session's log names their reports | 4 Nov | — |
| R5 | Plugins are first-party code in this repository; nothing from elsewhere loads through the plugin host. One that must, runs in its own process as a connector does | 4 Nov | test |
| R6 | One request of a person makes at most 8 asks or tasks given between agents and 4 hops in a chain, then waits for Continue; Alpha counts them, not the model, and the same ask is not made twice in one chain | 9 Nov | test |
| R7 | An agent's check only looks: it reads and cannot write, draft, send or use the model. A scheduled run cannot make or change a schedule | 10 Nov | test |
