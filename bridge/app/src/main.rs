//! Alpha Bridge: an icon in the Mac's menu bar or Windows' tray over the Bridge, which lends a
//! firm's Alpha what its person turns on here. The app runs the Bridge it carries (Node and the
//! bundled Bridge, in its resources) as its own child and tells it what to do in lines (bridge/src/
//! serve.ts); the Bridge keeps its key, its list and its connection exactly as in a terminal. Every
//! yes happens here: the folder picker, Sign out. It starts at sign-in and updates itself from the
//! Alpha it is paired with, refusing an update Kenil's updater key did not sign.

#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::io::{BufRead, BufReader, Write};
use std::path::PathBuf;
use std::process::{Child, ChildStdin, Command, Stdio};
use std::sync::Mutex;
use std::thread;
use std::time::Duration;

use serde_json::{json, Value};
use tauri::image::Image;
use tauri::menu::{CheckMenuItem, Menu, MenuItem, PredefinedMenuItem, Submenu};
use tauri::tray::{TrayIcon, TrayIconBuilder};
use tauri::{AppHandle, Manager, RunEvent};
use tauri_plugin_autostart::{MacosLauncher, ManagerExt as _};
use tauri_plugin_clipboard_manager::ClipboardExt;
use tauri_plugin_deep_link::DeepLinkExt;
use tauri_plugin_dialog::{DialogExt, MessageDialogButtons, MessageDialogKind};
use tauri_plugin_opener::OpenerExt;
use tauri_plugin_updater::UpdaterExt;

const TRAY: &[u8] = include_bytes!("../icons/tray.png");
const TRAY_WAITING: &[u8] = include_bytes!("../icons/tray-waiting.png");
const TRAY_COLOUR: &[u8] = include_bytes!("../icons/32x32.png");

/// What the Bridge last said of itself (serve.ts's `state`), and what it did last.
#[derive(Default, Clone)]
struct Seen {
    paired: bool,
    alpha: Option<String>,
    name: Option<String>,
    online: bool,
    turned_away: Option<String>, // Alpha turned it away (removed): pair again
    paused: Option<String>, // paused: until when, in words (until 9:30 PM, until you resume)
    lends: Vec<(String, String)>, // what it lends: (connector, account)
    doing: Option<String>,
}

/// The app's own state: the Bridge's pipe and what it last said.
#[derive(Default)]
struct Here {
    stdin: Mutex<Option<ChildStdin>>,
    child: Mutex<Option<Child>>,
    seen: Mutex<Seen>,
    quitting: Mutex<bool>,
}

/// The Bridge's own folder, as it finds it (bridge/src/config.ts): where it keeps what it did.
fn bridge_home() -> PathBuf {
    if cfg!(target_os = "windows") {
        PathBuf::from(std::env::var("APPDATA").unwrap_or_default()).join("Alpha Bridge")
    } else {
        PathBuf::from(std::env::var("HOME").unwrap_or_default())
            .join("Library/Application Support/Alpha Bridge")
    }
}

/// One line to the Bridge.
fn tell(app: &AppHandle, m: Value) {
    let here = app.state::<Here>();
    let mut stdin = here.stdin.lock().unwrap();
    if let Some(s) = stdin.as_mut() {
        let _ = writeln!(s, "{m}");
        let _ = s.flush();
    }
}

/// The Bridge, as the app carries it: Node and the bundled Bridge in the resources.
fn start_bridge(app: &AppHandle) {
    let res = match app.path().resource_dir() {
        Ok(r) => r.join("bridge"),
        Err(_) => return,
    };
    let node = if cfg!(target_os = "windows") {
        res.join("node").join("node.exe")
    } else {
        res.join("node").join("bin").join("node")
    };
    let script = res.join("app").join("src").join("bridge.mjs");
    let mut cmd = Command::new(node);
    cmd.arg(script)
        .arg("serve")
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());
    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        cmd.creation_flags(0x0800_0000); // no console window
    }
    let mut child = match cmd.spawn() {
        Ok(c) => c,
        Err(e) => {
            problem(app, &format!("Alpha Bridge could not start: {e}"));
            return;
        }
    };
    let stdout = child.stdout.take();
    let stderr = child.stderr.take();
    let here = app.state::<Here>();
    *here.stdin.lock().unwrap() = child.stdin.take();
    *here.child.lock().unwrap() = Some(child);
    // what it says goes to the icon and the menu; what it writes on stderr to its log
    if let Some(err) = stderr {
        thread::spawn(move || {
            let log = bridge_home().join("bridge.log");
            for line in BufReader::new(err).lines().map_while(Result::ok) {
                if let Ok(mut f) = std::fs::OpenOptions::new().create(true).append(true).open(&log) {
                    let _ = writeln!(f, "{line}");
                }
            }
        });
    }
    let app2 = app.clone();
    thread::spawn(move || {
        if let Some(out) = stdout {
            for line in BufReader::new(out).lines().map_while(Result::ok) {
                if let Ok(m) = serde_json::from_str::<Value>(&line) {
                    heard(&app2, m);
                }
            }
        }
        // it ended: started again, unless the app is quitting
        if !*app2.state::<Here>().quitting.lock().unwrap() {
            thread::sleep(Duration::from_secs(2));
            start_bridge(&app2);
        }
    });
}

/// A line from the Bridge.
fn heard(app: &AppHandle, m: Value) {
    let here = app.state::<Here>();
    match m["t"].as_str() {
        Some("state") => {
            let mut seen = here.seen.lock().unwrap();
            let was_paired = seen.paired;
            seen.paired = m["paired"].as_bool().unwrap_or(false);
            seen.alpha = m["alpha"].as_str().map(String::from);
            seen.name = m["name"].as_str().map(String::from);
            seen.online = m["online"].as_bool().unwrap_or(false);
            seen.turned_away = m["turnedAway"].as_str().map(String::from);
            seen.paused = m["paused"]["words"].as_str().map(String::from);
            seen.lends = m["lends"]
                .as_array()
                .map(|a| {
                    a.iter()
                        .filter_map(|v| {
                            Some((
                                v["connector"].as_str()?.to_string(),
                                v["account"].as_str()?.to_string(),
                            ))
                        })
                        .collect()
                })
                .unwrap_or_default();
            let now_paired = seen.paired && !was_paired;
            drop(seen);
            redraw(app);
            if now_paired {
                check_update(app);
            }
        }
        Some("did") => {
            here.seen.lock().unwrap().doing = m["words"].as_str().map(String::from);
            redraw(app);
        }
        // Alpha asked its person to lend a folder: the picker opens here, and only a pick lends
        Some("pick") => pick_folder(app),
        Some("problem") => problem(app, m["words"].as_str().unwrap_or("Something went wrong.")),
        _ => {}
    }
}

fn problem(app: &AppHandle, words: &str) {
    let app = app.clone();
    let words = words.to_string();
    thread::spawn(move || {
        app.dialog()
            .message(words)
            .title("Alpha Bridge")
            .kind(MessageDialogKind::Warning)
            .blocking_show();
    });
}

fn pick_folder(app: &AppHandle) {
    let app = app.clone();
    thread::spawn(move || {
        if let Some(path) = app.dialog().file().set_title("Lend Alpha a folder").blocking_pick_folder() {
            if let Ok(p) = path.into_path() {
                tell(&app, json!({ "t": "lend", "path": p.to_string_lossy() }));
            }
        }
    });
}

/// The icon and its menu, from what the Bridge last said.
fn redraw(app: &AppHandle) {
    let app2 = app.clone();
    let _ = app.run_on_main_thread(move || {
        let app = &app2;
        let seen = app.state::<Here>().seen.lock().unwrap().clone();
        let Some(tray) = app.tray_by_id("bridge") else { return };
        let status = if !seen.paired {
            "Not paired: open the link from Alpha".to_string()
        } else if seen.turned_away.is_some() {
            "Alpha turned this computer away: pair it again".to_string()
        } else if let Some(until) = &seen.paused {
            format!("Paused {until}")
        } else if seen.online {
            let host = seen
                .alpha
                .as_deref()
                .and_then(|a| url::Url::parse(a).ok())
                .and_then(|u| u.host_str().map(String::from))
                .unwrap_or_default();
            format!("Connected to {host}")
        } else {
            "Offline: trying again".to_string()
        };
        let _ = build_menu(app, &tray, &seen, &status);
        set_icon(&tray, seen.paired && seen.online && seen.paused.is_none());
        let _ = tray.set_tooltip(Some(format!("Alpha Bridge: {status}")));
    });
}

fn set_icon(tray: &TrayIcon, well: bool) {
    let bytes = if cfg!(target_os = "macos") {
        if well { TRAY } else { TRAY_WAITING }
    } else {
        TRAY_COLOUR
    };
    if let Ok(img) = Image::from_bytes(bytes) {
        let _ = tray.set_icon(Some(img));
        #[cfg(target_os = "macos")]
        let _ = tray.set_icon_as_template(true);
    }
}

fn build_menu(app: &AppHandle, tray: &TrayIcon, seen: &Seen, status: &str) -> tauri::Result<()> {
    let menu = Menu::new(app)?;
    menu.append(&MenuItem::with_id(app, "status", status, false, None::<&str>)?)?;
    if let Some(name) = &seen.name {
        menu.append(&MenuItem::with_id(app, "name", format!("This computer: {name}"), false, None::<&str>)?)?;
    }
    if let Some(doing) = &seen.doing {
        menu.append(&MenuItem::with_id(app, "doing", doing, false, None::<&str>)?)?;
    }
    menu.append(&PredefinedMenuItem::separator(app)?)?;
    if !seen.paired || seen.turned_away.is_some() {
        menu.append(&MenuItem::with_id(app, "pair", "Pair with the link I copied", true, None::<&str>)?)?;
    }
    if seen.paired && seen.turned_away.is_none() {
        let folders = Submenu::with_id(app, "folders", "Folders", true)?;
        let lent: Vec<&String> = seen
            .lends
            .iter()
            .filter(|(c, _)| c == "folder")
            .map(|(_, a)| a)
            .collect();
        for (i, f) in lent.iter().enumerate() {
            folders.append(&CheckMenuItem::with_id(app, format!("folder:{i}"), f, true, true, None::<&str>)?)?;
        }
        if !lent.is_empty() {
            folders.append(&PredefinedMenuItem::separator(app)?)?;
        }
        folders.append(&MenuItem::with_id(app, "add", "Add a folder…", true, None::<&str>)?)?;
        menu.append(&folders)?;
        // a Mac's own Calendar and Contacts, each off until ticked; macOS asks the first time
        if cfg!(target_os = "macos") {
            for (id, title) in [("calendar", "Calendar"), ("contacts", "Contacts")] {
                let on = seen.lends.iter().any(|(c, _)| c == id);
                menu.append(&CheckMenuItem::with_id(app, id, title, true, on, None::<&str>)?)?;
            }
        }
        if seen.paused.is_some() {
            menu.append(&MenuItem::with_id(app, "resume", "Resume", true, None::<&str>)?)?;
        } else {
            menu.append(&MenuItem::with_id(app, "pause-hour", "Pause for an hour", true, None::<&str>)?)?;
            menu.append(&MenuItem::with_id(app, "pause", "Pause until I resume", true, None::<&str>)?)?;
        }
    }
    menu.append(&MenuItem::with_id(app, "did", "What it did…", true, None::<&str>)?)?;
    if seen.alpha.is_some() {
        menu.append(&MenuItem::with_id(app, "open", "Open Alpha", true, None::<&str>)?)?;
    }
    menu.append(&PredefinedMenuItem::separator(app)?)?;
    let on = app.autolaunch().is_enabled().unwrap_or(false);
    menu.append(&CheckMenuItem::with_id(app, "login", "Start at sign-in", true, on, None::<&str>)?)?;
    if seen.paired {
        menu.append(&MenuItem::with_id(app, "signout", "Sign out…", true, None::<&str>)?)?;
    }
    menu.append(&MenuItem::with_id(app, "quit", "Quit Alpha Bridge", true, None::<&str>)?)?;
    tray.set_menu(Some(menu))
}

fn on_menu(app: &AppHandle, id: &str) {
    let seen = app.state::<Here>().seen.lock().unwrap().clone();
    match id {
        "pair" => {
            let text = app.clipboard().read_text().unwrap_or_default();
            if text.contains("pair=") {
                tell(app, json!({ "t": "pair", "link": text.trim() }));
            } else {
                problem(app, "Copy the pairing link from Alpha first: Connections, Your computers, Add this computer.");
            }
        }
        "add" => pick_folder(app),
        "calendar" | "contacts" => {
            let on = seen.lends.iter().any(|(c, _)| c == id);
            let t = if on { "unlend" } else { "lend" };
            tell(app, json!({ "t": t, "connector": id }));
        }
        "pause-hour" => tell(app, json!({ "t": "pause", "minutes": 60 })),
        "pause" => tell(app, json!({ "t": "pause", "minutes": null })),
        "resume" => tell(app, json!({ "t": "resume" })),
        "did" => {
            let file = bridge_home().join("did.txt");
            let _ = app.opener().open_path(file.to_string_lossy(), None::<&str>);
        }
        "open" => {
            if let Some(a) = seen.alpha {
                let _ = app.opener().open_url(a, None::<&str>);
            }
        }
        "login" => {
            let auto = app.autolaunch();
            let _ = if auto.is_enabled().unwrap_or(false) { auto.disable() } else { auto.enable() };
            redraw(app);
        }
        "signout" => {
            let app = app.clone();
            thread::spawn(move || {
                let yes = app
                    .dialog()
                    .message("Alpha stops reading what this computer lends, and you pair it again to go on.")
                    .title("Sign out of Alpha?")
                    .buttons(MessageDialogButtons::OkCancelCustom("Sign out".into(), "Cancel".into()))
                    .blocking_show();
                if yes {
                    tell(&app, json!({ "t": "signout" }));
                }
            });
        }
        "quit" => {
            *app.state::<Here>().quitting.lock().unwrap() = true;
            if let Some(mut c) = app.state::<Here>().child.lock().unwrap().take() {
                let _ = c.kill();
            }
            app.exit(0);
        }
        other => {
            // a lent folder's tick: stop lending it
            if let Some(i) = other.strip_prefix("folder:").and_then(|i| i.parse::<usize>().ok()) {
                let folders: Vec<&String> = seen
                    .lends
                    .iter()
                    .filter(|(c, _)| c == "folder")
                    .map(|(_, a)| a)
                    .collect();
                if let Some(path) = folders.get(i) {
                    tell(app, json!({ "t": "unlend", "path": path }));
                }
            }
        }
    }
}

/// A link from Alpha (alpha-bridge://pair?link=…): paired with what it carries.
fn opened(app: &AppHandle, urls: Vec<url::Url>) {
    for u in urls {
        if u.scheme() != "alpha-bridge" {
            continue;
        }
        if let Some((_, link)) = u.query_pairs().find(|(k, _)| k == "link") {
            tell(app, json!({ "t": "pair", "link": link }));
        }
    }
}

/// The newest version, from the Alpha it is paired with, at start and every six hours: installed
/// and started again when Kenil's updater key signed it.
fn check_update(app: &AppHandle) {
    let app = app.clone();
    tauri::async_runtime::spawn(async move {
        let Some(alpha) = app.state::<Here>().seen.lock().unwrap().alpha.clone() else { return };
        let platform = if cfg!(target_os = "windows") { "win-x64" } else { "darwin-arm64" };
        let version = app.package_info().version.to_string();
        let Ok(endpoint) = url::Url::parse(&format!("{alpha}/api/bridge/update/{platform}/{version}")) else { return };
        let Ok(builder) = app.updater_builder().endpoints(vec![endpoint]) else { return };
        let Ok(updater) = builder.build() else { return };
        if let Ok(Some(update)) = updater.check().await {
            if update.download_and_install(|_, _| {}, || {}).await.is_ok() {
                *app.state::<Here>().quitting.lock().unwrap() = true;
                if let Some(mut c) = app.state::<Here>().child.lock().unwrap().take() {
                    let _ = c.kill();
                }
                app.restart();
            }
        }
    });
}

fn main() {
    tauri::Builder::default()
        // one Alpha Bridge: a second start, or a link opened while it runs, goes to this one
        .plugin(tauri_plugin_single_instance::init(|_app, _argv, _cwd| {}))
        .plugin(tauri_plugin_deep_link::init())
        .plugin(tauri_plugin_autostart::init(MacosLauncher::LaunchAgent, None))
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .manage(Here::default())
        .setup(|app| {
            #[cfg(target_os = "macos")]
            app.set_activation_policy(tauri::ActivationPolicy::Accessory);
            let handle = app.handle().clone();
            TrayIconBuilder::with_id("bridge")
                .icon(Image::from_bytes(if cfg!(target_os = "macos") { TRAY_WAITING } else { TRAY_COLOUR })?)
                .icon_as_template(cfg!(target_os = "macos"))
                .show_menu_on_left_click(true)
                .on_menu_event(|app, e| on_menu(app, e.id().as_ref()))
                .build(app)?;
            // starts at sign-in from the first time it runs; the menu's tick turns it off
            let marker = bridge_home().join("app-started");
            if !marker.exists() {
                let _ = std::fs::create_dir_all(bridge_home());
                let _ = app.autolaunch().enable();
                let _ = std::fs::write(&marker, "");
            }
            #[cfg(any(target_os = "windows", target_os = "linux"))]
            let _ = app.deep_link().register_all();
            let h = handle.clone();
            app.deep_link().on_open_url(move |e| opened(&h, e.urls()));
            start_bridge(&handle);
            if let Ok(Some(urls)) = app.deep_link().get_current() {
                let h = handle.clone();
                // the Bridge reads its pipe once started
                thread::spawn(move || {
                    thread::sleep(Duration::from_secs(1));
                    opened(&h, urls);
                });
            }
            redraw(&handle);
            let h = handle.clone();
            thread::spawn(move || loop {
                thread::sleep(Duration::from_secs(6 * 60 * 60));
                check_update(&h);
            });
            Ok(())
        })
        .build(tauri::generate_context!())
        .expect("Alpha Bridge could not start")
        .run(|app, e| {
            // no window to close: it runs until Quit
            if let RunEvent::ExitRequested { api, code, .. } = e {
                if code.is_none() && !*app.state::<Here>().quitting.lock().unwrap() {
                    api.prevent_exit();
                }
            }
        });
}
