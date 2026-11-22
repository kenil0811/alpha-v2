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
