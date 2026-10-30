# Outlook

The person's Microsoft 365 mail, signed in as them with their organisation's own sign-in app:
Alpha reaches only their own mailbox. Inbox and Sent Items of the last 90 days are kept in the
Mail table (view `mail`), beside any Gmail account's: who it was from, to whom, the subject, the
date, the folder (Labels) and the conversation (Thread), with each row pointing at its message.
For anything older, or in another folder, search Outlook itself. A message's text is read only
when it is needed, by its Message ID.

Outlook only reads for now: Alpha cannot save a draft or send from it yet.
