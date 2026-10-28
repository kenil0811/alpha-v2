# Install Alpha on a fresh Mac

The steps to install Alpha from the file Kenil sends you.

## Before you start

- A Mac with Apple silicon (M1 or later) on macOS 14 Sonoma or newer, signed in as an
  administrator, with about 3 GB free.
- The Alpha file Kenil sent you, for example Alpha-0.5.1.dmg, in your Downloads folder.
- Your own Claude account, on a Pro or Max subscription.
- Your Gmail address, with 2-Step Verification turned on.
- Google Chrome, only if one of your sources needs you to sign in (Kumo does).

## Install

1. Double-click the file in Downloads. A window opens with Alpha and an Applications folder.
2. Drag Alpha onto Applications. Then open your Applications folder and double-click Alpha.
3. macOS says it could not verify Alpha (it is not notarized by Apple yet). Open System
   Settings › Privacy & Security, scroll to Security, and press **Open Anyway** beside Alpha;
   macOS asks for your Mac password once. Alpha opens.
4. Alpha's first window says Install. Press it, and read the lines as it goes: it puts Alpha's
   folder in your Library, sets Alpha to start when you log in, and starts it. It never asks for
   your Mac password. When macOS says "Background item added", that is Alpha starting at login.
5. Alpha opens in its own window. Its face sits in a corner of your screen and its mark in the
   menu bar. macOS asks once whether Alpha may send notifications: choose Allow. You can eject
   the Alpha disk image from the Finder sidebar.

## First open

6. **Sign in to Claude.** The first line on Alpha's Home says so: press Sign in. A page opens in
   your browser; sign in with your Claude account there and come back to Alpha. The line turns
   green. Alpha works on your own Claude subscription and never sees your password or your
   sign-in.
7. **Connect Gmail.** At myaccount.google.com/apppasswords, make an app password named Alpha and
   copy its 16 letters. In Alpha, open Intelligence (at the foot of the rail) › Connections ›
   Gmail and enter your address and those letters.
8. **Calendar and contacts.** If your Google account isn't on the Mac yet, add it in System
   Settings › Internet Accounts with Calendars and Contacts on. Then connect Calendar and Contacts
   in Alpha's Intelligence › Connections; macOS asks once for each, and you choose Allow.
9. **Your modules are already there.** They are in the rail, and their agents start paused.
   Check their settings (a deal search's sources and thesis, say), then press Turn on all in
   Settings › Modules.
10. **Sites that need your sign-in.** When a Sign in card appears, press Sign in. Chrome opens
    that site in a separate Alpha window; sign in there yourself, then quit Chrome with ⌘Q. Alpha
    never sees your password.
11. **Let it prepare.** Home and Settings › Permissions (On this Mac) show the reading browser and the document
    reader downloading, about 1.8 GB. Alpha works meanwhile; reading sites and PDFs starts when
    they are ready.

## Every day

- Alpha opens by itself when you log in: its face in the corner, its mark in the menu bar. Click
  the face to type to Alpha, or press ⌃⌥A from anywhere. Open the window from the mark, from the
  Dock or from Alpha in Applications. Closing the window doesn't stop Alpha.
- Reminders and what needs you come as notifications from Alpha; click one to open it. Hide the
  face from the menu bar if you don't want it.
- While the Mac is plugged in, Alpha keeps it from sleeping; the screen still turns off. On
  battery, or with the lid closed, the Mac sleeps, and Alpha catches up once when it wakes and
  notes it in Activity.

## Updates

- **A new Alpha:** Kenil sends a new file. Quit Alpha first (its mark in the menu bar › Quit
  Alpha). Open the file, drag Alpha onto Applications and choose Replace, then open Alpha. Its
  window says Update: press it. It backs up your data first, and
  your data and settings stay. (The Open Anyway step comes once more, as it is a new file.)
- **If something goes wrong,** open Terminal (⌘Space, type Terminal) and type:
  `/Applications/Alpha.app/Contents/Resources/app/bin/alpha report`. A report lands on your
  Desktop, with versions, what is installed and recent errors, never your rows; send it to Kenil.
  `alpha rollback` the same way goes back to the Alpha before the update.

## Removing Alpha

In Terminal: `/Applications/Alpha.app/Contents/Resources/app/bin/alpha uninstall`. It stops Alpha,
takes it out of login and Applications, and leaves your data in your Library;
`alpha uninstall --remove-data` moves the data to the Trash too, after you type remove.
