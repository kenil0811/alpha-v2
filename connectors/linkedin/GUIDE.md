# LinkedIn

The person's LinkedIn connections, read as the person: they signed in themselves in Google Chrome,
and Alpha reads their own connections page the way they would scroll it, once a day, the newest
first, stopping at any check page. Kept in LinkedIn connections (view `linkedin_connections`):
name, profile link, headline, position and company when the headline says them, and when they
connected. Each connection is one of the person's people (view `people`). Alpha never writes to
LinkedIn: no messages, no invitations.
