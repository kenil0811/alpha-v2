# 28 October 2026: a rule that names a connector holds

Found by the journeys run for a client's kit (journey `a-rule-holds` failed twice, passed once): a
deny rule saved as "through gmail" or "through gmail.send" never covered the desk's Gmail send.
The gate named the call by its key, `gmail_send`, which no rule's words hold, so the send went to
an approval card instead of being refused. It held only when the model saved the rule with no
`through`. Agents' drafts already named their send `gmail.send`, as the design says.

The gate now hands the rules what they call a connector's tool (`ruleName`, `<connector>.<tool>`)
beside its key, which the cards and Always keep. Test in `engine/gate.test.ts`, with Gmail's real
tool, for both forms: it failed before the change. Kenil's "lets fix", 28 Oct.

Also, for the client's kit: a journey step `drop` gives files to Alpha dropped on a named row, as the
window's drop on a row does, so a journey can show where a filed export lands.
