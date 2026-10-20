# Registering Alpha's Google app

*Not now (Kenil, 19 Oct 2026): kept for when a client needs Google's own access. Until then a
Google calendar and contacts come through the Mac's Calendar and Contacts.*

Design §8: register a Google OAuth app now, in the background, with only the calendar and
contacts scopes, so Google's verification runs while the rest is built. These are **sensitive**
scopes: verification needs a review but no CASA security assessment (only Gmail's restricted
scopes need that). Gmail stays on app passwords until a client needs more.

This is Kenil's to do in his own Google account; Alpha never signs in to the console.

## Before you start

- A domain you own for Alpha, verified in Google Search Console.
- On that domain: a home page saying what Alpha is, a privacy policy, and terms. The privacy
  policy must say what Alpha does with Google user data (read the calendar and contacts to know the
  person's meetings and people; kept on their own Mac; never sold or shared) and include Google's
  Limited Use statement.
- A support email address.

## Steps (console.cloud.google.com)

1. **New project:** "Alpha".
2. **APIs & Services › Library:** enable **Google Calendar API** and **People API**.
3. **Google Auth Platform › Branding:** app name "Alpha", support email, logo, the home page,
   privacy policy and terms links, and the authorised domain.
4. **Audience:** External. Add yourself as a test user while it is being verified.
5. **Data access › Add scopes:** only these two:
   - `https://www.googleapis.com/auth/calendar.readonly`
   - `https://www.googleapis.com/auth/contacts.readonly`
   For each, one sentence on why: "Alpha reads the person's calendar to know their meetings and
   who was in them" and "Alpha reads their contacts to know the people they deal with".
6. **Clients › Create client:** type **Desktop app**, name "Alpha for Mac". Keep the client ID;
   a desktop client's secret is not a secret, but keep it out of the repository all the same.
7. **Audience › Publish app**, then **Verification centre › Prepare for verification**: a short
   screen recording of the consent screen and of Alpha showing a calendar event and a contact,
   and the scope justifications above.

Google says sensitive-scope verification usually takes from a few days to a few weeks. Nothing in
Alpha uses this app until it is verified; the first client's calendar and contacts come from their Mac.
