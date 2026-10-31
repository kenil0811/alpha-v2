# 30 October 2026: Governance as its own section

Design only, from the 27–30 Oct review commit, on main's core.

- `window/src/Governance.tsx`: Governance is its own section on a module's Agents and notes tab,
  right after Agents: two columns, Can do and Cannot do, of the rules `/api/rules` holds for the
  module and all of Alpha. Approved rules are solid; one Alpha noticed is greyed on dots with
  Approve, Decline behind ⋮ (revoke). A rule is typed at the foot of a column and goes to Alpha
  (`/api/say`), whose Save card makes it. The sites line is gone: a figure, not a rule.
- `Module.tsx`: the old Allowed / Denied block replaced; `RuleColumn`, `why` and `Rule` kept and
  exported for the agent page.
- `docs/ui-rules.md` M3 rewritten to match.

Waits on core: rules asked for and not saved yet (`/api/rules/waiting`, shown greyed with
Approve), rules for one agent under its name, and Settings › Governance across Alpha. The work
left / standard column right layout lives on the Overview, a later slice.
