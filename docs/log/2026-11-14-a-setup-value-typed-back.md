# 14 Nov 2026: a kit update after a setup value typed back

Found while trying a client's kit on Kenil's Mac's Alpha: a kit's update was refused, whole, with
"… is the person's own value, so it changes only when they ask for it", and nothing of the update
went in.

The cause: a setup row the kit marks as assumed, whose value the person typed over and then typed
back to the kit's own. Its values equal the kit's again, so the update took the row as unchanged
and landed it. The landing leaves a person's value alone, but the step after it marked the value
as the kit's assumption again, which the rule that keeps a person's value (D2) refuses, and the
refusal undid the update.

The fix: on a kit's update a value the person made their own is not marked as the kit's
assumption again. The row lands as before, their value and its mark stand, and the update goes
in. A test holds it (`kits.test.ts`: the person types another address, then the kit's own, and
the next version installs).

Not changed: the row then reads as unchanged from the kit, so a later version's new value for it
would be landed for every field but the one the person made theirs.
