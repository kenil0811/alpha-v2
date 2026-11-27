//! Alpha Bridge's code inside the Alpha app on a PC: the same Bridge the separate Alpha Bridge app
//! runs (bridge/src/serve.ts), Node and the bundled Bridge in this app's resources, run as this
//! app's child and told what to do in lines. It pairs with this PC's own Alpha by itself, reads the
//! PC's folders and works on its Chrome on the Windows side (Windows' files are slow to read from
//! inside Linux), and its switches (a folder, the browser, pause) are in Alpha's menu by the clock,
//! as they are on Alpha's own Your computers page. Its folder is AlphaData\bridge, never the
//! separate app's, so the two can sit side by side; it ends with this app (a job Windows closes
//! with it), so an update or an uninstall never finds its files in use.

use std::io::{BufRead, BufReader, Write};
use std::os::windows::io::AsRawHandle;
use std::os::windows::process::CommandExt;
use std::path::PathBuf;
use std::process::{Child, ChildStdin, Command, Stdio};
use std::sync::{Mutex, OnceLock};
use std::thread;
use std::time::{Duration, Instant};

use serde_json::{json, Value};
use tauri::menu::{CheckMenuItem, MenuItem, PredefinedMenuItem, Submenu};
use tauri::{AppHandle, Manager, Wry};
use tauri_plugin_dialog::DialogExt;
use windows_sys::Win32::System::JobObjects::{
    AssignProcessToJobObject, CreateJobObjectW, JobObjectExtendedLimitInformation,
    SetInformationJobObject, JOBOBJECT_EXTENDED_LIMIT_INFORMATION, JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE,
};

use super::{data_dir, notify, NO_WINDOW};

/// This PC's own Alpha, as Windows reaches it inside Alpha's Linux.
const ALPHA: &str = "http://127.0.0.1:4700";
/// The key's name in Credential Manager, as the Bridge keeps it (bridge/src/keys.ts).
const KEY_SERVICE: &str = "Alpha Bridge";
const KEY_ACCOUNT: &str = "127.0.0.1:4700";

/// What the Bridge last said of itself.
#[derive(Default, Clone)]
struct Seen {
    heard: bool,
    paired: bool,
    online: bool,
    turned_away: bool,
    paused: Option<String>, // until when, in words
    browser: bool,
    folders: Vec<String>,
}

#[derive(Default)]
struct Part {
    stdin: Mutex<Option<ChildStdin>>,
    seen: Mutex<Seen>,
    asked: Mutex<Option<Instant>>, // the last pairing it asked for by itself
    pairing: Mutex<bool>,          // that pairing has not answered yet
}

/// Its lines in Alpha's menu, made with the menu and changed as the Bridge says.
pub struct Lines {
    pub status: MenuItem<Wry>,
    pub folders: Submenu<Wry>,
    pub browser: CheckMenuItem<Wry>,
    pub pause: MenuItem<Wry>,
}

pub fn lines(app: &AppHandle) -> tauri::Result<Lines> {
    let add = MenuItem::with_id(app, "pc-add", "Add a folder…", true, None::<&str>)?;
    Ok(Lines {
        status: MenuItem::with_id(app, "pc-status", "This PC: starting", false, None::<&str>)?,
        folders: Submenu::with_id_and_items(app, "pc-folders", "Folders", false, &[&add])?,
        browser: CheckMenuItem::with_id(app, "pc-browser", "Browser", false, false, None::<&str>)?,
        pause: MenuItem::with_id(app, "pc-pause", "Pause for an hour", false, None::<&str>)?,
    })
}

fn home() -> PathBuf {
    data_dir().join("bridge")
}

/// What the Bridge wrote on its stderr, and what went wrong here, kept in its folder.
fn log(words: &str) {
    let file = home().join("bridge.log");
    if std::fs::metadata(&file).map(|m| m.len() > 2_000_000).unwrap_or(false) {
        let _ = std::fs::rename(&file, home().join("bridge.old.log"));
    }
    if let Ok(mut f) = std::fs::OpenOptions::new().create(true).append(true).open(&file) {
        let _ = writeln!(f, "{words}");
    }
}

/// Started with the app (not while it installs): the Bridge, and pairing it when it is not.
pub fn start(app: &AppHandle) {
    app.manage(Part::default());
    run(app);
    let h = app.clone();
    thread::spawn(move || loop {
        thread::sleep(Duration::from_secs(10));
        pair_by_itself(&h);
    });
}

/// The job its Bridge runs in: Windows ends the Bridge when this app ends, however it ends.
static JOB: OnceLock<usize> = OnceLock::new();

fn held(child: &Child) {
    let job = *JOB.get_or_init(|| unsafe {
        let job = CreateJobObjectW(std::ptr::null(), std::ptr::null());
        let mut info: JOBOBJECT_EXTENDED_LIMIT_INFORMATION = std::mem::zeroed();
        info.BasicLimitInformation.LimitFlags = JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE;
        SetInformationJobObject(
            job,
            JobObjectExtendedLimitInformation,
            &info as *const _ as *const std::ffi::c_void,
            std::mem::size_of::<JOBOBJECT_EXTENDED_LIMIT_INFORMATION>() as u32,
        );
        job as usize
    });
    unsafe {
        AssignProcessToJobObject(job as _, child.as_raw_handle() as _);
    }
}

/// The Bridge as this app carries it; started again when it ends.
fn run(app: &AppHandle) {
    let Ok(res) = app.path().resource_dir() else { return };
    let res = res.join("bridge");
    let node = res.join("node").join("node.exe");
    if !node.exists() {
        return; // a build without the Bridge's part
    }
    let _ = std::fs::create_dir_all(home());
    let mut child = match Command::new(node)
        .arg(res.join("app").join("src").join("bridge.mjs"))
        .arg("serve")
        .env("ALPHA_BRIDGE_HOME", home())
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .creation_flags(NO_WINDOW)
        .spawn()
    {
        Ok(c) => c,
        Err(e) => return log(&format!("Alpha Bridge's part did not start: {e}")),
    };
    held(&child);
    let started = Instant::now();
    *app.state::<Part>().stdin.lock().unwrap() = child.stdin.take();
    if let Some(err) = child.stderr.take() {
        thread::spawn(move || {
            for line in BufReader::new(err).lines().map_while(Result::ok) {
                log(&line);
            }
        });
    }
    let out = child.stdout.take();
    let app = app.clone();
    thread::spawn(move || {
        if let Some(out) = out {
            for line in BufReader::new(out).lines().map_while(Result::ok) {
                if let Ok(m) = serde_json::from_str::<Value>(&line) {
                    heard(&app, m);
                }
            }
        }
        let _ = child.wait();
        // one that ends at once waits longer, so a broken one does not start every few seconds
        let quick = started.elapsed() < Duration::from_secs(30);
        log("Alpha Bridge's part ended; starting it again.");
        thread::sleep(Duration::from_secs(if quick { 60 } else { 3 }));
        run(&app);
    });
}

/// One line to the Bridge.
fn tell(app: &AppHandle, m: Value) {
    if let Some(s) = app.state::<Part>().stdin.lock().unwrap().as_mut() {
        let _ = writeln!(s, "{m}");
        let _ = s.flush();
    }
}

/// A line from the Bridge.
fn heard(app: &AppHandle, m: Value) {
    let part = app.state::<Part>();
    match m["t"].as_str() {
        Some("state") => {
            let mut seen = part.seen.lock().unwrap();
            seen.heard = true;
            seen.paired = m["paired"].as_bool().unwrap_or(false);
            seen.online = m["online"].as_bool().unwrap_or(false);
            seen.turned_away = m["turnedAway"].is_string();
            seen.paused = m["paused"]["words"].as_str().map(String::from);
            seen.browser = m["browser"].as_bool().unwrap_or(false);
            seen.folders = m["lends"]
                .as_array()
                .map(|a| {
                    a.iter()
                        .filter(|l| l["connector"] == "folder")
                        .filter_map(|l| l["account"].as_str().map(String::from))
                        .collect()
                })
                .unwrap_or_default();
            if seen.paired {
                *part.pairing.lock().unwrap() = false;
            }
            drop(seen);
            redraw(app);
        }
        // Alpha asked its person to lend a folder: the picker opens here, and only a pick lends
        Some("pick") => pick_folder(app),
        Some("problem") => {
            let words = m["words"].as_str().unwrap_or("Something went wrong.");
            log(words);
            // a pairing it asked for by itself tries again quietly; what the person did is answered
            let mut pairing = part.pairing.lock().unwrap();
            if *pairing {
                *pairing = false;
            } else {
                notify::show("bridge", "Alpha", None, words, "");
            }
        }
        _ => {}
    }
}

/// A one-time link from this PC's own Alpha, for this PC (Your computers' own).
fn link() -> Option<String> {
    let token = super::token()?;
    let body = ureq::post(&format!("{ALPHA}/api/computers/link"))
        .set("x-alpha-token", &token)
        .set("content-type", "application/json")
        .timeout(Duration::from_secs(8))
        .send_string("{}")
        .ok()?
        .into_string()
        .ok()?;
    serde_json::from_str::<Value>(&body).ok()?["link"].as_str().map(String::from)
}

/// Not paired yet (a new install): paired with this PC's Alpha once it answers, at most once a
/// minute. Turned away (its person removed this PC in Alpha) it waits for their word in the menu.
fn pair_by_itself(app: &AppHandle) {
    let part = app.state::<Part>();
    let seen = part.seen.lock().unwrap().clone();
    if !seen.heard || seen.paired {
        return;
    }
    if part.asked.lock().unwrap().is_some_and(|t| t.elapsed() < Duration::from_secs(60)) {
        return;
    }
    pair(app);
}

fn pair(app: &AppHandle) {
    let Some(link) = link() else { return };
    let part = app.state::<Part>();
    *part.asked.lock().unwrap() = Some(Instant::now());
    *part.pairing.lock().unwrap() = true;
    tell(app, json!({ "t": "pair", "link": link }));
}

fn pick_folder(app: &AppHandle) {
    let app = app.clone();
    thread::spawn(move || {
        let mut dialog = app.dialog().file().set_title("Lend Alpha a folder");
        if let Some(w) = app.get_webview_window("main").filter(|w| w.is_visible().unwrap_or(false)) {
            dialog = dialog.set_parent(&w);
        }
        if let Some(path) = dialog.blocking_pick_folder().and_then(|p| p.into_path().ok()) {
            tell(&app, json!({ "t": "lend", "path": path.to_string_lossy() }));
        }
    });
}

/// Its lines in the menu, from what the Bridge last said.
fn redraw(app: &AppHandle) {
    let h = app.clone();
    let _ = app.run_on_main_thread(move || {
        let Some(lines) = h.try_state::<Lines>() else { return };
        let seen = h.state::<Part>().seen.lock().unwrap().clone();
        let working = seen.paired && !seen.turned_away;
        let status = if !seen.paired {
            "This PC: pairing with Alpha".to_string()
        } else if seen.turned_away {
            "This PC was removed in Alpha: pair it again".to_string()
        } else if let Some(until) = &seen.paused {
            format!("This PC: paused {until}")
        } else if !seen.online {
            "This PC: connecting to Alpha".to_string()
        } else {
            match seen.folders.len() {
                0 => "This PC: no folders lent yet".to_string(),
                1 => "This PC: 1 folder lent".to_string(),
                n => format!("This PC: {n} folders lent"),
            }
        };
        let _ = lines.status.set_text(status);
        let _ = lines.status.set_enabled(seen.paired && seen.turned_away);
        while let Ok(Some(_)) = lines.folders.remove_at(0) {}
        for (i, f) in seen.folders.iter().enumerate() {
            if let Ok(item) = CheckMenuItem::with_id(&h, format!("pc-folder:{i}"), f, true, true, None::<&str>) {
                let _ = lines.folders.append(&item);
            }
        }
        if !seen.folders.is_empty() {
            if let Ok(line) = PredefinedMenuItem::separator(&h) {
                let _ = lines.folders.append(&line);
            }
        }
        if let Ok(add) = MenuItem::with_id(&h, "pc-add", "Add a folder…", true, None::<&str>) {
            let _ = lines.folders.append(&add);
        }
        let _ = lines.folders.set_enabled(working);
        let _ = lines.browser.set_checked(seen.browser);
        let _ = lines.browser.set_enabled(working);
        let _ = lines.pause.set_text(if seen.paused.is_some() { "Resume" } else { "Pause for an hour" });
        let _ = lines.pause.set_enabled(working);
    });
}

/// One of its lines in the menu, chosen.
pub fn on_menu(app: &AppHandle, id: &str) {
    let seen = app.state::<Part>().seen.lock().unwrap().clone();
    match id {
        "pc-add" => pick_folder(app),
        "pc-browser" => tell(app, json!({ "t": "browser", "on": !seen.browser })),
        "pc-pause" if seen.paused.is_some() => tell(app, json!({ "t": "resume" })),
        "pc-pause" => tell(app, json!({ "t": "pause", "minutes": 60 })),
        "pc-status" => {
            let h = app.clone();
            thread::spawn(move || pair(&h));
        }
        other => {
            // a lent folder's tick: it is lent no more
            let folder = other
                .strip_prefix("pc-folder:")
                .and_then(|i| i.parse::<usize>().ok())
                .and_then(|i| seen.folders.get(i));
            if let Some(path) = folder {
                tell(app, json!({ "t": "unlend", "path": path }));
            }
        }
    }
    // a tick shows what the Bridge says, not the click, until it says otherwise
    redraw(app);
}

/// Uninstalled: this PC's pairing goes with Alpha's Linux, its folder and its key both.
pub fn forget() {
    let _ = std::fs::remove_dir_all(home());
    let script = format!(
        "[void][Windows.Security.Credentials.PasswordVault,Windows.Security.Credentials,ContentType=WindowsRuntime]; \
         $v = New-Object Windows.Security.Credentials.PasswordVault; \
         try {{ $v.FindAllByResource('{KEY_SERVICE}') | Where-Object {{ $_.UserName -eq '{KEY_ACCOUNT}' }} | ForEach-Object {{ $v.Remove($_) }} }} catch {{}}"
    );
    let _ = Command::new("powershell.exe")
        .args(["-NoProfile", "-NonInteractive", "-Command", &script])
        .creation_flags(NO_WINDOW)
        .status();
}
