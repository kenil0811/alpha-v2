# Install Alpha on a fresh Mac

The steps to install Alpha from the file Kenil sends you.

## Before you start

- A Mac with Apple silicon (M1 or later) on macOS 14 Sonoma or newer, signed in as an
  administrator, with about 3 GB free.
- The Alpha file Kenil sent you, for example Alpha-0.3.0.tar.gz, in your Downloads folder.
- Your own Claude account, on a Pro or Max subscription.
- Your Gmail address, with 2-Step Verification turned on.
- Google Chrome, only if one of your sources needs you to sign in (Kumo does).

## Install

1. Double-click the file in Downloads. A folder called Alpha appears beside it.
2. Open Terminal: press ⌘Space, type Terminal, press Return.
3. Type `sh` and a space, drag install.sh from the Alpha folder onto the Terminal window, and
   press Return.
4. Read what it says as it goes. It checks the Mac, puts Alpha in Applications, makes Alpha's
   folder, sets Alpha to start when you log in, and starts it. Partway through it starts Claude's
   own sign-in: a browser page opens, you sign in with your Claude account, and you come back to
   Terminal. It never asks for your Mac password. When macOS says "Background item added", that
   is Alpha starting at login.
5. Alpha opens in its own window. Its face sits in a corner of your screen and its mark in the
   menu bar. macOS asks once whether Alpha may send notifications: choose Allow. You can close
   Terminal.

## First open

6. **Check Claude.** Alpha's first screen shows Claude signed in with your account. Alpha works
   on your own Claude subscription and never sees your password or your sign-in.
7. **Connect Gmail.** At myaccount.google.com/apppasswords, make an app password named Alpha and
   copy its 16 letters. In Alpha, open Settings › Connections › Gmail and enter your address and
   those letters.
8. **Calendar and contacts.** If your Google account isn't on the Mac yet, add it in System
   Settings › Internet Accounts with Calendars and Contacts on. Then connect Calendar and Contacts
   in Alpha's Settings; macOS asks once for each, and you choose Allow.
9. **Your kits are already there.** Your modules are in the rail, and their agents start paused.
   Check their settings (a deal search's sources and thesis, say), then press Turn on all in
   Settings › Kits and agents.
10. **Sites that need your sign-in.** When a Sign in card appears, press Sign in. Chrome opens
    that site in a separate Alpha window; sign in there yourself, then quit Chrome with ⌘Q. Alpha
    never sees your password.
11. **Let it prepare.** Home and Settings › This Mac show the reading browser and the document
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

- **A new Alpha:** Kenil sends a new file. Unpack it and run its install.sh the same way (steps
  2 and 3). It sees Alpha is there, backs up your data, updates, and opens Alpha again. Your data
  and settings stay.
- **A new version of a kit:** Settings › Kits and agents › Update from a file. What you changed
  stays yours.

## If something goes wrong

- **Alpha doesn't open:** open Alpha from Applications; it starts Alpha if it had stopped.
- **To see what Alpha is doing,** paste this into Terminal and press Return:

```
"/Applications/Alpha.app/Contents/Resources/app/bin/alpha" status
```

- **To send Kenil a report,** run the same line with `report` in place of `status`. It puts a
  file on your Desktop with versions, health and recent log lines, never your rows. Send Kenil
  that file.
- Alpha's logs are in ~/Library/Logs/Alpha.

## Uninstall

- The same line with `uninstall` removes Alpha, its login item, its Keychain items and its
  permissions. Your data stays in ~/Library/Application Support/Alpha.
- `uninstall --remove-data` also moves your data to the Trash, after you type "remove".
