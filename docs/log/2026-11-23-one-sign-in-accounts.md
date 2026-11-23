# 23 Nov: one sign-in, one line per account

Vikas asked for connecting Microsoft and Google with one sign-in, one Add for any number of
accounts, one line each, and nothing deleted vanishing. Built on `claude/one-sign-in-accounts`:
`core/config/signin.yaml` names Alpha's own Microsoft and Google apps, empty until Kenil registers
them, so today's firm-own app flow is unchanged; when filled, Microsoft signs in on `common` with
an admin approval link for a business that blocks it. Connect and Settings › Connections share
`window/src/AccountLines.tsx`: Add (Google · Microsoft · Other mail, Business · Personal), a line
per address (a Google account's mail and calendar together), Disconnect and Delete under the
pointer, Excluded at the foot with Restore, deleted accounts kept per person beside the apps left
out. Mail through Google's own sign-in is not built: its scope needs Google's yearly review, so
mail stays on an app password inside the Google line. Journey `two-accounts-one-excluded` passes.
Not looked at in the app: another worktree's Alpha held this Mac's one running core.
