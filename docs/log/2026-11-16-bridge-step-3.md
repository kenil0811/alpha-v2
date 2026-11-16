# 16 Nov 2026: Alpha Bridge, step 3 (Calendar and Contacts)

Kenil's "looks good, lets do it" to step 3 (doc 8WMFsNV7ahT8gJGHPosA8t): all five calls as
recommended.

- A Mac lends its own Calendar and Contacts through Alpha Bridge: two ticks in the menu (Mac only),
  off until ticked. The app carries Alpha's helper (`connector-sdk/helper`, signed ad hoc) and the
  Mac connectors (`mac.mjs`); the Bridge answers a connector's helper asks on the Mac, so macOS asks
  that Mac's person. Calendar and Contacts say `runs: either`; on a server their tile says to turn
  them on in Alpha Bridge. Your computers names what a computer lends (its Calendar).
- One Events and one Contacts table for every source (`EVENTS`, `CONTACTS` in the SDK), each in its
  own module (a table may name its module now), as Gmail and Outlook share Mail. Unlike the step 3
  doc's line that each source keeps its own tables: one table, each row keeping its source, so
  what reads Events reads all, as with Mail.
- Outlook reads Calendars.Read and Contacts.Read too (the setup sheet lists seven permissions); a
  sign-in made before reads mail as ever and says in the journal that calendar and contacts need a
  new sign-in.
- A Google connector (Calendar and Contacts, People API) and Google as a sign-in provider: the
  firm's own Google Cloud app (Kenil's while testing, published unverified), PKCE with the secret
  sent as basic credentials, offline access with consent each time; its setup sheet in Sign-in apps.
- Tests on made-up Graph and Google answers; a stand-in Mac lending its Calendar in `bridge.test.ts`
  and in the journey (its recorded answer). Alpha Bridge 0.3.0.
- Waits on Kenil: approving the two permissions in his test directory's Entra; making the Google
  app and typing its ID and secret into Sign-in apps. Then I check each once.
