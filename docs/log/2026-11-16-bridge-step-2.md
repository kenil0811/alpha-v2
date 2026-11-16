# 16 Nov 2026: Alpha Bridge, step 2 (the app on both)

Step 1 worked on Kenil's Mac and Windows PC; he asked for an app with no terminal. His "looks good"
to step 2 (doc 6LzJsmpoQbapkntQXWhoLh): all six calls as recommended.

- `bridge/app/`: Alpha Bridge, a Tauri app with the step 1 Bridge inside as its child, told what to
  do in lines (`alpha-bridge serve`, bridge/src/serve.ts). An icon in the menu bar or tray; its
  menu: what it is doing, Folders (each lent folder, Add a folder…), Pause for an hour or until
  resumed, What it did… (did.txt), Open Alpha, Start at sign-in (on from the first run), Sign out…,
  Quit. A pairing on the terminal carries over: the same folder, the same key.
- Pairing by an `alpha-bridge:` link from Your computers (Open in Alpha Bridge), the link pasted as
  the fallback (Pair with the link I copied). Lend a folder on a computer's row asks the app to
  open its picker; only a pick lends (rule B2's new case).
- Pause: the Bridge refuses every call while paused and Alpha's tile says Paused on it, with no
  card; Sign out removes the computer in Alpha and pauses what it lent.
- Updates: `/api/bridge/update/<platform>/<version>` and `/api/bridge/app/<file>`, without a session
  (A6 names them), only for files Kenil's signature holds; the app checks Tauri's own signature with
  the updater key, made today, its private half in his Keychain ("Alpha Bridge updater key").
- `pnpm bridge mac`: the disk image and the update, signed ad hoc as the Mac app is (there is no
  signing certificate on this Mac). `pnpm bridge windows`: the setup program from GitHub's Windows
  machine (`.github/workflows/bridge-windows.yml`, on a push of a bridge-* branch), signed on the
  Mac. `pnpm server bridge` sends every signed file.
- Journey `a-computer-lends-a-folder` gains a pause and a resume; passed.
