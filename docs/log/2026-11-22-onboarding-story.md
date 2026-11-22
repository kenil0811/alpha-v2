# 22 Nov 2026: Set up Alpha, step 1: journeys first

Kenil's calls on "Alpha onboarding, redesigned" (https://claude.ai/artifact/DqMVu13HL6tiapKKdymEvj):
onboarding leaves the agent chat and becomes Set up Alpha, a full-screen story of chapters drawn by
code, the core owning Welcome, Claude, Your workspace, Connect, Your people and Done and the
interviews plugin adding Get to know you and What I learned. Twenty-five calls as recommended;
call 6 rewritten to his note (nothing has to be ready before handover), call 10 with it. Six
build steps, each looked at and pushed on his "looks good"; this one is the journeys.

The five onboarding journeys now press through the story's routes instead of answering cards in
a chat, and two are new: a fresh Alpha with interviews off goes Welcome, Claude (refusing a Skip
while no model is set, then given the runner's token), Your workspace, Connect, Your people and
Done, and lands on a Home that answers; and a member joins a workspace already set up, through
Welcome, What's here, Connect and Done, told only that the tables are everyone's here. The
runner gained what they need (`core/src/journeys/story-steps.ts`): a `story` step (a chapter's
act, its Skip, a Skip it must refuse, chapters skipped up to one, What I learned answered
question by question), a `member` step, `claude: unset` for an Alpha with no way to Claude yet,
and the `story`, `story_says` and `needs_you` checks. The routes they hold the build to are
written at the top of that file. All seven run and fail at the first story route (404), as they
should until steps 2 to 5 build it; the reports are the latest of each.

## Step 2: the story itself

Each person's way through Set up Alpha is kept in the world: a `story` table (migration 11, tried
on a backup copy of the Mac's world first), each chapter done or skipped, and when they finished
or declined. Everyone already in a live Alpha is marked done by the migration, so no one is pushed
into it. Which chapters a person has is the core's to say (`core/src/api/story.ts`): the owner's
Welcome, Claude (only while no model is set, and kept on the path once gone through), Your
workspace, Connect, Your people (only where people sign in, as Settings › People is) and Done; a
member's Welcome, What's here, Connect your own and Done. A plugin adds its own chapters through a
new host call, `chapter`, placed after Connect or after Your people, for the owner or for everyone
(step 4 moves the interview there). The member's two chapters came now rather than in step 5,
since the story's list needed them; step 5 keeps the monthly check and the playback.

Routes in `core/src/api/routes/story.ts`, screens and acts in `core/src/api/story-screens.ts`: a
chapter is acted on only once those before it are gone through or skipped, so Claude can't be gone
round; its Skip is refused while no model is set. A token given to Claude's chapter is kept only
after Claude answered with it (`answersWith`, its words in `core/config/checking.md`); a Mac signs
in in the browser and the chapter watches for it. Your workspace keeps the name and picture as
before, and now who the work is for (the owner's own words) and the website, guessed from the
owner's own mail domain, never a mail provider's. Your people adds people with one-time links and
sends nothing. Your workspace and Your people refuse a member as Settings does (rules A6, its test
now trying both). The story's routes are in the doors list.

The window: the story replaces the window while it is open (`window/src/story/`), opening by
itself on a person's first time; the path at the left (a bar on a phone), Alpha's face and its
line as the title, Back, Skip and the chapter's act at the foot. Home's one row, Carry on setting
up with how far, Carry on and Decline. Set up Alpha in the workspace tile's menu opens it again
from the start. New ui-rules U1 to U4.

The journey runner builds its pages as on a server (people sign in, reached as the alpha command
is) so Your people is there; a fresh-Alpha journey says up front when no Claude token was handed
to the run. A member joins and An Alpha without interviews pass; A fresh Alpha sets itself up
holds up to Claude and needs a token (the Mac has none to give it).

Found on the look: the Mac's own Alpha isn't signed in to Claude (its journal says so twice today),
so its story rightly puts Claude second.

## Step 3: Connect in place

On Kenil's look at step 2 ("can we have the connections here itself"), step 3 came next on the
same branch. Connect is now tiles drawn by the core (`core/src/api/story-connect.ts`), each saying
what it reads before anything is connected: Outlook and Gmail (Gmail's app password guided in three
steps, Google's pages opening in a new tab), Calendar and contacts (a Mac's own connected on the
tile; on a server, Outlook's and the Bridge's, with this month's events and Network's people and
organizations counted), Google, Your computer (Alpha Bridge downloaded and paired from the tile on a
server; folders added by path on Alpha's own Mac), Apps you use (one list of both, on Kenil's
word: the apps on the person's computer as Alpha Bridge's Apps reader lists them, used in the last
30 days, and the work apps in `core/config/apps.yaml` with two mails or more from their site's
domain, an app seen both ways once; those Alpha can connect or sign in to first; the computer's part
only where interviews are on, since the reader comes with them; an ✕ on a row leaves that app out
for good, kept per person), the systems the installed modules read (a
kit's `uses`), and Something you work from (dropped, it goes to the Module builder as New module's
Import does). A provider's sign-in app is set up on its tile, from the same sheet as Settings. A
member sees only what is theirs to connect, and the firm's systems once connected for everyone.
The window reuses Settings' pieces (the connect form, the sign-in app's sheet, the Bridge's install
steps, the site sign-in), each now shared. New ui-rule U5. On his look ("why are we wasting so much space") the tiles became one compact
row each down a wider column: name, one line of what it reads (the rest in its ⓘ), its act at the
right, what landed under it; on a phone the act moves under the name.

## A site's sign-in as a small window

On Kenil's word (a Google sign-in pop-up beside the full LinkedIn window Alpha opened), a site's
sign-in now opens in Chrome as a small window of its own, `--app` at 520 by 760, with no tabs and
no toolbar: on Alpha's own Mac (`connector-sdk/src/browser.ts`) and through Alpha Bridge
(`bridge/src/chrome.ts`), released as Alpha Bridge 0.5.1 for the Mac and put on his server and his
Mac. The Windows build waits on GitHub's machine, which needs the branch pushed.

## Step 4: Get to know you and What I learned

On "lets do step 4". The interview leaves the Interviewer's chat for two chapters the interviews
plugin adds to Set up Alpha (`plugins/interviews/src/know.ts`, `draft.ts`, `learned.ts`; the window
part's `chapters`). Get to know you: one screen of every source the person has (and the
workspace's site for the owner), what each reads and holds, a switch each; Read these reads every
one left on together, the computer's readers read there and then, the site's front page and the
pages it links to read in the background (`site.ts`), and what was found shows as it comes. A
source switched off is marked Skipped and never read or given to the draft (I3). Then one model
question, `host.ask`, its words in the plugin's `config.yaml`, drafts About you, the workflows
with their steps, and the blanks as a set; the walls hold every line (I1), counts and hours are
worked out in code (I2), and a dropped line or a declined proposal, by its name or what it does,
never comes back (I4). The answers go back together once the set is answered; each workflow with
no blanks gets its playback; Not this writes it again; twelve rounds at most stop a loop that never
settles. About you kept in the story goes to How to work through a new host call, `keep`, as the
person's own; the workspace comes to the plugin through another, `workspace`. Build it on an agreed
module gives the Module builder the playback as its brief, as New module does. The report module
(0.4.0) gains a Questions table (a line cites an answer as answer <its id>) and a Name on each
proposal. The old Home row and its Start, Decline and Finish now routes are gone; the plugin's
page points to Set up Alpha and Your work. Rules I1, I3 and I4 are now tried through the chapters
too; ui-rule U6. Found: this Mac's Claude Code is not signed in, so the journeys that call the
model fail here at the draft (the runner now says why); they wait on that sign-in. On his server, two cards from the old chat interview (started from the old Home row at
17:07, before step 4 reached it) waited in Needs you; the Interviewer's source tool now reads only
what was switched on in Get to know you and never asks for a source on a card (rule I3 reworded). On his look, what each source found was shown as the
reader's raw words (row ids, file hashes, MIME kinds); the person now sees a line or two, the first
three of each list and no ids (`shownOf`), and What I learned's wait shows one line per source. AI
work leaves out text a tool put in a session in the person's name (a harness's tags). Two more on his look: a Keep on What I learned, opened
again with Back after the story had gone on, jumped forward (a chapter's own act now moves the
story only when the plugin says on); and each workflow is now a card that opens, its state as a pill
(Waits for you, Agreed, Questions first), the one waiting on him open by itself. And
opening Set up Alpha again from the workspace tile reset every tick on the path, which read as all
gone though nothing was (his server kept its 8 About you lines, 3 workflows and 6 answers): it now
keeps what was gone through, opens at Welcome, and each Continue goes to the next chapter.

## Step 5: a member's story, the monthly check, and a playback for every module

On "lets do it". A member's link page is now their Welcome to the workspace: its name and picture,
who added them, the three promises, and Start, which sets their password and marks Welcome gone
through, so they land on What's here (GET /api/session/link carries it; the picture as its data
address, since they are not signed in yet). The Interviewer's regular check is a schedule its kit
carries, "A short interview", on the first of each month: its check only looks (the person's
requests said three times or more, values they typed over, tasks they made, apps and sites read
again) and wakes the Interviewer only when it found something; then its new tool,
`short_interview`, opens What I learned again for that person through a new host call, `reopen`,
with what changed, and the few new questions are drafted from it, so Home shows one row and
nothing waits in Needs you. Alpha's own kits now turn on the schedules of the agents they carry,
as their modules' are (the check came paused before). The Module builder plays back before it
builds anything, on a card with Yes, that's it; Yes, and also; Not this, except a report's Build
it, which says it was played back already. Modules left unopened are not looked at: nothing in the
journal says a module was opened. The journeys, run on the real model now that this Mac
reaches Claude again, found four things, fixed: schedules gain "every month" (a first-of-the-month
timer that never ran only fires in its own minute) and the check runs on it; a shipped agent's
`checks/` now come with its schedules (they were left behind, so its check could not run); the
owner's own words for who the work is for are citable as answer workspace, and an owner who works
alone ("Just me") keeps those lines as their own; the journeys' made-up site serves its front page,
and their checks read the answers and playbacks kept in the story. A member joins, a quiet month,
the full interview and both who-the-work-is-for journeys pass.

On his "ok", GitHub refused the push: the interview journey's report held a token. The journey's
stand-in computer had read this Mac's own browsing history (since step 2) and, with AI work lent in
step 5, its own Claude Code requests, and its report kept them; two such reports were already on
main. On his yes, they were taken out of main's history (02fd47d to 36c2798 rewritten, force-pushed
as 27e25bc). The stand-in computer now reads a home made up from the journey's recorded answers
(`recordedHome`, where ALPHA_COMPUTER_HOME points; a Bridge child's start can carry an environment),
so a journey never reads the Mac it runs on; the interview journey has recorded AI work and passes
on it. And on his second yes, the never-use list leaves out a key or token by its form (shapes in
its credentials kind: Hugging Face, OpenAI and Anthropic, GitHub, GitLab, AWS, Google, Slack,
Stripe, private keys, signed web tokens), from every connection (N1). Alpha leaves them out as they
land now; on a computer, before they leave it, from the Bridge's next version.

## Step 6: the look

On his "Yes start". Every chapter, owner and member, drawn by the core for a made-up firm on a
fresh server, shot in WebKit and Chromium, light and dark, a window and a phone. What it found,
fixed: the window had never had the plugins' own styles (the `@source` glob for plugins' window
parts matched nothing since 2 Nov), so Get to know you and What I learned had gone without some
of their spacing and widths; a server's Calendar and contacts tile had nothing to press and said
nothing (it now says they come with Outlook or Alpha Bridge); a member's mail tile offered to set
up the provider's sign-in app, which is the owner's (it now waits on them, by name); on a phone,
tiles' acts sat beside or under their names by chance and cut a title, About you lines were
squeezed beside their buttons, a workflow's name was cut by its hours, and the Welcome's promise
and Get to know you's lines were cut (each now wraps or goes under its name); What's here listed
people in a sentence (now rows) and said "already has" with nothing there; Done said "Here's
where I'll start" with nothing connected, and told a member they could add people; the first
chapter showed a Back that did nothing; a workflow agreed in its table read Questions first
without a Yes on its playback; Get to know you's empty sources said "ask again" from the chat
days (they now point a step back to Connect). His Mac greets "kenil" because that is the Mac
account's full name. Alpha Bridge goes to 0.5.2 for the key and token shapes.

## A pasted token

On his word, after someone he shared his server with had Claude refuse a good token: it had
come with extra spaces. A token or key pasted in (the Claude chapter, Settings' token and API key)
now has every space, line break and invisible mark taken out, in the field as it is typed and again
in the core before it is checked or kept; and every hidden field for a token, a key or a secret
has an eye to show it and check it first.
