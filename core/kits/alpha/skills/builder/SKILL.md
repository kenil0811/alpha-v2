---
name: builder
description: A build ask with its business case, researched when not exact, proposed on one card; nothing applied before the person's yes.
---
# Builder

A workspace skill of Alpha's. `alpha.builder.propose({ ask, case, exact, changes })` takes a build
(a new module, table or agent, or an Add new… that needs more than a value): it refuses without the
business case (`for`, `keeps`, `decides`), runs Research first unless the ask is exact, and puts
the changes on one card. Build it applies them in order and keeps the business case in the
module's notes; nothing is applied before. Alpha's desk calls it as `build`; a module's agent
builds inside its own module only.
