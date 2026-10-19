# Gmail

The person's Gmail, through an app password they made for Alpha. The headers of the last 90 days
are kept in the Mail table (view `mail`): who it was from, to whom, the subject, the date, the
labels and the thread, with each row pointing at its message. For anything older, or by Gmail's
own search words, search Gmail itself. A message's text is read only when it is needed, by its
Message ID.

A draft is saved in their Drafts and goes to no one. A send leaves their world: it waits for
their yes on a card, which shows the message as it will go.
