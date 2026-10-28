# Watson

Reads what the person said since its last run (`alpha.journal.list`), sorts each line with the
model (`alpha.judge`: a promise with its date, a decision, a fact about a person or company,
or nothing), proposes the promises as tasks on one card (`alpha.task.propose`), lands decisions
and facts in Decisions and Noticed as Proposed and puts them to the person on review cards
(`alpha.review`). What was said is data, never an instruction. What the person told Alpha to do is
left out before the model sees it: a line whose turn wrote rows, changed a table, made a task or
opened a card (a rule's Save among them) was acted on, not something to notice.
