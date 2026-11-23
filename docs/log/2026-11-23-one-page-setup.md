# 23 Nov 2026: Set up Alpha on one page

Vikas, on a fresh install: "connecting to LLM, workspace, everything could have been a single
continuous scrollable page", warmer words "more like a proposal", and "nothing is compulsory, even
your computer". Built on `claude/one-page-setup`, every change marked proposed for Kenil.

The story's chapters are now steps of one page (`window/src/story/Story.tsx`): a slim progress bar
and Later at the top, each step opening under the one before once done or skipped. The core still
owns the steps and their state; the order is Hello, About you, Connect my thinking, Your computer
(its tile on a step of its own), Your accounts, Invite team, then the interview's What I learned,
A few questions and Off your plate, and Done. About you guesses the organization's name from the
mail domain (a pencil to change it), asks "Is harborreno.com your organization's website?" with a
tick and a cross, and Business or Personal (`workspace_use`); who the work is for is no longer
asked on the first run. Promises and lines say permission and approval. Get to know you and its
switches are gone: what is connected is read in the background when What I learned is drawn, and
again when more is connected; a source is turned off only in Your work's Interview sources (rule
I3 reworded). A step on which nothing happened is marked skipped, never done; Done says what is
true and, without the interview, offers one box for something the person repeats. Invite team
makes links only on Send. Claude can be skipped, as the last commit, so Kenil can drop it.

Journeys run here (no Claude sign-in): an Alpha without interviews, a member joins and the new
everything skipped ends on something to do pass; the ones that call the model were adjusted, not
run. Not looked at in the app.

Later, on Vikas's "show one step at a time… let it appear layer by layer" and "rolled out phase
wise when the prerequisites are met": only the step the person is on is open; each one gone through
folds to one line with what happened, said by the core (`summary` on each step), and Change opens
it again in place. Your computer only installs and pairs Alpha Bridge, and Your accounts lists the
accounts and, once a computer is paired, Found on your computer: the apps Alpha Bridge found, each
with Connect, or How to connect by hand (a browser's history exported), and Exclude. Files to work
from and the Bridge's other readers are no longer offered in Set up Alpha.

Then, on "make this flow same as it was earlier… each section fits the entire screen… dots… like a
slideshow, but vertical": each step fills the screen and the page snaps a step at a time (CSS
scroll-snap); vertical dots at the right replace the progress bar and the folded lines, a step
gone through named with what happened in its dot's tip, nothing ahead named. On a first visit
Hello's line types itself out (`window/src/ui/typing.tsx`) and the promises fade in after it. Not
looked at in the app.
