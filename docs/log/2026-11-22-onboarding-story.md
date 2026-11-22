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
