# 1 November 2026: onboarding step 2, the platform layer

From the final design (~/Desktop/dev/alpha/onboarding/design.md, §4 and §10 step 2), Kenil's yes of
18:06.

- `connector-sdk/src/local.ts`: the reader's contract every connector uses, the same on every
  computer: the five access words (ready, ask, settings, absent, refused), the three folders, and
  Visit, Browser, AppSeen, AppTime, FileSeen and LocalReader (access, browsers, visits, apps, app
  time, files, show settings). Moments are ISO strings; nothing names an operating system.
- `Platform.local(helper)`: the Mac gives `MacReader` (`core/src/platform/mac-local.ts`); the plain
  platform gives none, the slot a Windows reader fills. `process.platform` is still read only in
  `platform/index.ts`.
- The Mac reader: Chrome through the shared Chromium reader, the rest through the helper run as the
  app; the helper's refusals become the five words with where macOS switches Alpha on (Full Disk
  Access, or Files & Folders); Screen Time's spans become seconds per app per day on the person's
  own day (a span counts on the day it began); a name's kind is its extension, folder or project.
- The helper's walk, from the trial: a folder with a `.git` is one project and is not walked, and
  the newest 50,000 are kept. On Kenil's Desktop: 14,961 files in 1,659 folders and 12 projects,
  where step 1's walk stopped at its cap inside one code folder.
- Tests: the Mac reader on step 1's recordings with the helper faked (shapes, access words, where to
  switch Alpha on, the day count in two zones, kinds); the plain platform has no reader.
- The helper was rebuilt, so macOS asked again for the three folders, and Full Disk Access needs
  Alpha dragged in again before Safari and Screen Time read (the ad hoc signing of step 1's log).
