# Journey a-member-joins: 2026-11-23 08:50

A member added to a workspace already set up goes through their own shorter story, never seeing Claude or Your people, and is told only what is true about what is shared

Fresh tenant, model claude-opus-5-5, on Claude Code, Alpha's prompt alone.
**Passed** in 2 s, $0.00.


## 1. The owner went through welcome

Took 1.1 s.


## 2. The owner went through workspace

Took 0.0 s.


## 3. The owner skipped computer, connect, people to done

Took 0.0 s.


## 4. The owner went through done

Took 0.0 s.

- pass: the owner's story: done (saw 200: welcome, workspace, computer, connect, people, done; at null; done; row none)

## 5. The owner added Priya (priya@harborbooks.example)

Took 0.0 s.

- pass: Priya's story: chapters welcome, here, computer, connect, done; at welcome; not done (saw 200: welcome, here, computer, connect, done; at welcome; not done; row Carry on setting up)

## 6. Priya went through welcome

Took 0.0 s.

- pass: Priya's here says /Harbor Books/ (saw 200: {"key":"here","title":"What’s here","says":"Here’s who is in Harbor Books.","workspace":"Harbor Books","modules":[],"agents":[],"people":["Kenil"],"shared":"The tables here are everyone’s: what you add, everyone here can see, and what they add, you can."})
- pass: Priya's here says /everyone/, never /private/ (saw 200: {"key":"here","title":"What’s here","says":"Here’s who is in Harbor Books.","workspace":"Harbor Books","modules":[],"agents":[],"people":["Kenil"],"shared":"The tables here are everyone’s: what you add, everyone here can see, and what they add, you can."})

## 7. Priya went through here

Took 0.1 s.


## 8. Priya went through computer

Took 0.1 s.


## 9. Priya went through connect

Took 0.0 s.


## 10. Priya went through done

Took 0.0 s.

- pass: Priya's story: done; no Home row (saw 200: welcome, here, computer, connect, done; at null; done; row none)
- pass: the owner's story: done (saw 200: welcome, workspace, computer, connect, people, done; at null; done; row none)
- pass: errors: 0 (saw 0)

The journal verifies, rows included: 3 lines.

## The world after
