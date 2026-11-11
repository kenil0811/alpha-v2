# Recorded answers

What a connector answers in a journey, so no journey touches a real account. One folder per
connector; a file is `<call>-<hash of its arguments>.json`, or `<call>-any.json` for a call whose
arguments the model chooses (a search, a draft, a send). The people and companies in them are
made up.

A journey that needs answers of its own names a folder under `journeys/` here with `fixtures:`;
its files are laid over the shared ones for that journey alone, and `{site}` in them is said as the
journey's made-up site once it is served.
