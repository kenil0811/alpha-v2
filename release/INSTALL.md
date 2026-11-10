# Install Alpha on a Mac

The steps to install Alpha from the file Kenil sends you.

## Before you start

- A Mac with Apple silicon (M1 or later) on macOS 14 Sonoma or newer, signed in as an
  administrator, with about 3 GB free.
- The Alpha file Kenil sent you, for example Alpha-0.5.1.dmg, in your Downloads folder.
- Your own Claude account, on a Pro or Max subscription.

## Install

1. Double-click the file in Downloads and drag Alpha onto Applications. Then double-click Alpha
   in Applications.
2. macOS says it could not verify Alpha (it is not notarized by Apple yet). Open System Settings ›
   Privacy & Security, scroll to Security and press **Open Anyway** beside Alpha. Alpha opens.
3. Press **Install** and read the lines as it goes: Alpha is put in Applications, keeps its data in
   your Library and starts when you log in. It never asks for your Mac password.
4. Alpha opens in its own window, with its mark in the menu bar. macOS asks once whether Alpha may
   send notifications: choose Allow.

## First open

5. **Sign in to Claude** in Settings › Model, at the foot of the rail. A page opens in your
   browser: sign in there and come back. Alpha works on your own subscription and never sees your
   password.
6. **Connect your accounts** in Intelligence › Connections: Gmail with an app password, Outlook,
   Calendar and Contacts on this Mac, and folders Alpha should read. What you type stays in the
   Keychain.
7. **Make your first module.** New module in the rail opens a chat with the Module builder: say
   what you want kept and done.
8. Settings › Permissions shows the reading browser and the document reader downloading (about
   1.8 GB). Alpha works meanwhile; reading sites and PDFs starts once they are ready.

## Every day

- Alpha starts when you log in. Open the window from the menu bar's mark, the Dock or
  Applications. Closing the window doesn't stop Alpha.
- Alpha's face at the right of the bar opens the assistant. What needs you comes as a notification;
  click one to open it.

## Updates and help

- **A new Alpha:** quit Alpha (the mark in the menu bar › Quit Alpha), open the new file, drag
  Alpha onto Applications and choose Replace, then open it and press **Update**. Your data is
  backed up first and stays. Open Anyway comes once more.
- **If something goes wrong,** in Terminal type
  `/Applications/Alpha.app/Contents/Resources/app/bin/alpha report` and send Kenil the report it
  puts on your Desktop. It holds versions and recent errors, never your rows. `alpha rollback`
  goes back to the Alpha before the update.
- **To remove Alpha:** `alpha uninstall` the same way stops it and takes it out of login and
  Applications, leaving your data in your Library. `alpha uninstall --remove-data` also moves the
  data to the Trash, after you type remove.
