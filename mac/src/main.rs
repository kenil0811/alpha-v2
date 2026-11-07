//! Alpha on the Mac (design §14 and §15, Kenil's plan of 21 Oct): Alpha's own window and a mark in
//! the menu bar, over the core the login item runs, or the one a developer runs on the same port.
//! The shell never starts a core of its own, so there is one Alpha. Closing the window leaves
//! Alpha running; Quit closes the shell, and the core carries on with agents and reminders.

use std::path::PathBuf;
use std::sync::Mutex;
use std::thread;
use std::time::Duration;

use tauri::image::Image;
use tauri::menu::{Menu, MenuItem, PredefinedMenuItem};
use tauri::tray::{TrayIcon, TrayIconBuilder};
use tauri::webview::{DownloadEvent, NewWindowResponse};
use tauri::{
    AppHandle, Manager, RunEvent, TitleBarStyle, Url, WebviewUrl, WebviewWindow,
    WebviewWindowBuilder, WindowEvent,
};
use tauri_plugin_opener::OpenerExt;

mod install;
mod notify;

const TRAY: &[u8] = include_bytes!("../icons/tray.png");
const TRAY_WAITING: &[u8] = include_bytes!("../icons/tray-waiting.png");

/// Where the core is: its data folder (with the per-install token) and its port, as the login
/// item and the alpha command set them.
#[derive(Clone)]
struct Core {
    home: PathBuf,
    port: u16,
}

impl Core {
    fn here() -> Core {
        let home = std::env::var_os("ALPHA_HOME").map(PathBuf::from).unwrap_or_else(|| {
            PathBuf::from(std::env::var("HOME").unwrap_or_default())
                .join("Library/Application Support/Alpha")
        });
        let port = std::env::var("ALPHA_PORT")
            .ok()
            .and_then(|p| p.parse().ok())
            .unwrap_or(4700);
        Core { home, port }
    }

    fn token(&self) -> Option<String> {
        std::fs::read_to_string(self.home.join("token"))
            .ok()
            .map(|t| t.trim().to_string())
            .filter(|t| !t.is_empty())
    }

    fn origin(&self) -> String {
        format!("http://127.0.0.1:{}", self.port)
    }

    /// The window's address at a place in it (`#/activity`), with the token.
    fn url(&self, hash: &str) -> Option<Url> {
        let token = self.token()?;
        Url::parse(&format!("{}/?t={}{}", self.origin(), token, hash)).ok()
    }

    fn ours(&self, url: &Url) -> bool {
        url.host_str() == Some("127.0.0.1") && url.port() == Some(self.port)
    }

    // a slow Mac answers late while the core sets up: the wait is generous
    fn answering(&self) -> bool {
        ureq::get(&format!("{}/api/health", self.origin()))
            .timeout(Duration::from_secs(8))
            .call()
            .is_ok()
    }

    /// The core's login item started again (or for the first time), when this Mac has one.
    fn start(&self) -> bool {
        let home = std::env::var("HOME").unwrap_or_default();
        let plist = format!("{home}/Library/LaunchAgents/io.github.kenil0811.alpha.core.plist");
        if !std::path::Path::new(&plist).exists() {
            return false;
        }
        let uid = std::process::Command::new("/usr/bin/id")
            .arg("-u")
            .output()
            .map(|o| String::from_utf8_lossy(&o.stdout).trim().to_string())
            .unwrap_or_default();
        let label = format!("gui/{uid}/io.github.kenil0811.alpha.core");
        let _ = std::process::Command::new("/bin/launchctl").args(["bootout", &label]).status();
        let loaded = std::process::Command::new("/bin/launchctl")
            .args(["bootstrap", &format!("gui/{uid}"), &plist])
            .status()
            .map(|s| s.success())
            .unwrap_or(false);
        // launchd may pend a start-at-load ("on-demand-only mode"); a demand starts it anyway
        let _ = std::process::Command::new("/bin/launchctl").args(["kickstart", &label]).status();
        loaded
    }

    /// The reminders and cards since `after` (none the first time: only where to start), and
    /// where to start next.
    fn notices(&self, after: Option<u64>) -> Option<(u64, Vec<serde_json::Value>)> {
        let token = self.token()?;
        let url = match after {
            Some(after) => format!("{}/api/notices?after={after}", self.origin()),
            None => format!("{}/api/notices", self.origin()),
        };
        let body = ureq::get(&url)
            .set("x-alpha-token", &token)
            .timeout(Duration::from_secs(4))
            .call()
            .ok()?
            .into_string()
            .ok()?;
        let got: serde_json::Value = serde_json::from_str(&body).ok()?;
        let last = got["last"].as_u64()?;
        Some((last, got["notices"].as_array().cloned().unwrap_or_default()))
    }

    /// How many things wait on the person: cards in Needs you and connections to sign in to.
    fn needs(&self) -> Option<usize> {
        let token = self.token()?;
        let body = ureq::get(&format!("{}/api/stream", self.origin()))
            .set("x-alpha-token", &token)
            .timeout(Duration::from_secs(4))
            .call()
            .ok()?
            .into_string()
            .ok()?;
        let stream: serde_json::Value = serde_json::from_str(&body).ok()?;
        let count = |key: &str| stream[key].as_array().map(|a| a.len()).unwrap_or(0);
        Some(count("cards") + count("attention"))
    }
}

/// What the menu bar's mark shows and its menu says, kept so it changes only when it must.
struct Mark {
    tray: TrayIcon,
    needs: MenuItem<tauri::Wry>,
    shown: Mutex<Option<usize>>,
}

/// The Install window's commands: what this install is, run it, and Not now.
#[tauri::command]
fn install_plan(app: AppHandle) -> install::Plan {
    install::plan(&app)
}

#[tauri::command]
fn install(app: AppHandle) {
    install::run(app);
}

#[tauri::command]
fn install_quit(app: AppHandle) {
    app.exit(0);
}

/// The starting page's Start Alpha: the core's login item, started again.
#[tauri::command]
fn start_core(core: tauri::State<'_, Core>) -> bool {
    core.start()
}

fn main_window(app: &AppHandle) -> Option<WebviewWindow> {
    app.get_webview_window("main")
}

/// The window, brought forward at a place in Alpha (`#/settings`), or as it was.
fn show(app: &AppHandle, core: &Core, hash: Option<&str>) {
    let Some(window) = main_window(app) else { return };
    let _ = window.unminimize();
    let _ = window.show();
    let _ = window.set_focus();
    let Some(hash) = hash else { return };
    let on_core = window.url().map(|u| core.ours(&u)).unwrap_or(false);
    if on_core {
        let _ = window.eval(format!("window.location.hash = {}", serde_json::json!(hash)));
    } else if let Some(url) = core.url(hash) {
        let _ = window.navigate(url);
    }
}

/// Started at login (`--quietly`), Alpha opens no window: the mark is there.
fn quietly() -> bool {
    std::env::args().any(|a| a == "--quietly")
}

/// A note in the shell's log, when ALPHA_SHELL_LOG names a file (for looking into a problem).
fn note(words: &str) {
    if let Some(f) = std::env::var_os("ALPHA_SHELL_LOG") {
        if let Ok(mut log) = std::fs::OpenOptions::new().create(true).append(true).open(f) {
            use std::io::Write;
            let _ = writeln!(log, "{words}");
        }
    }
}

/// `--at <hash>`: the window opened at a place in Alpha (a notification's, or a look).
fn at() -> String {
    let args: Vec<String> = std::env::args().collect();
    args.iter()
        .position(|a| a == "--at")
        .and_then(|i| args.get(i + 1).cloned())
        .unwrap_or_default()
}

fn build_window(app: &AppHandle, core: &Core) -> tauri::Result<WebviewWindow> {
    // the core's page when it answers; otherwise the shell's own, until it does
    let start = match core.url(&at()).filter(|_| core.answering()) {
        Some(url) => WebviewUrl::External(url),
        None => WebviewUrl::App("index.html".into()),
    };
    let links = core.clone();
    let opener = app.clone();
    let windows = app.clone();
    WebviewWindowBuilder::new(app, "main", start)
        .title("Alpha")
        .visible(!quietly())
        // the first click on the window does what it says, instead of only bringing it forward
        .accept_first_mouse(true)
        .inner_size(1280.0, 840.0)
        .min_inner_size(960.0, 600.0)
        // the window's own bars hold the traffic lights: the rail leaves them room
        .title_bar_style(TitleBarStyle::Overlay)
        .hidden_title(true)
        .disable_drag_drop_handler()
        // a web page outside Alpha (a site, a document's source) opens in its own app; everything
        // else stays: the core's pages, the shell's own, and the frames a module's page is drawn in
        // (about:srcdoc), blobs and data
        .on_navigation(move |url| {
            note(&format!("navigate {url}"));
            let web = matches!(url.scheme(), "http" | "https");
            if web && !links.ours(url) {
                let _ = opener.opener().open_url(url.as_str(), None::<&str>);
                return false;
            }
            true
        })
        .on_new_window(move |url, _| {
            let _ = windows.opener().open_url(url.as_str(), None::<&str>);
            NewWindowResponse::Deny
        })
        // an export lands in Downloads, as a browser would put it
        .on_download(|webview, event| {
            if let DownloadEvent::Requested { url, destination } = event {
                let name = destination
                    .file_name()
                    .map(|n| n.to_os_string())
                    .or_else(|| url.path_segments().and_then(|s| s.last()).map(Into::into))
                    .unwrap_or_else(|| "Alpha download".into());
                if let Ok(downloads) = webview.app_handle().path().download_dir() {
                    *destination = downloads.join(name);
                }
            }
            true
        })
        .build()
}

/// Every few seconds: the window goes to the core once it answers, the menu bar's mark says
/// whether anything waits on the person, and what came since the last look is shown as notices.
fn watch(app: AppHandle, core: Core) {
    let mut cursor: Option<u64> = None;
    thread::spawn(move || loop {
        let answering = core.answering();
        if answering {
            if let Some((last, notices)) = core.notices(cursor) {
                // a card is in front of the person already when Alpha's window is
                let looking = main_window(&app)
                    .map(|w| w.is_focused().unwrap_or(false) && w.is_visible().unwrap_or(false))
                    .unwrap_or(false);
                for n in notices {
                    let text = |k: &str| n[k].as_str().unwrap_or_default().to_string();
                    if looking && text("title") != "Reminder" {
                        continue;
                    }
                    let subtitle = n["subtitle"].as_str();
                    notify::show(&text("id"), &text("title"), subtitle, &text("body"), &text("open"));
                }
                cursor = Some(last);
            }
        }
        if answering {
            if let Some(window) = main_window(&app) {
                let on_core = window.url().map(|u| core.ours(&u)).unwrap_or(false);
                if !on_core {
                    if let Some(url) = core.url("") {
                        let _ = window.navigate(url);
                    }
                }
            }
        }
        let needs = if answering { core.needs() } else { None };
        if let Some(mark) = app.try_state::<Mark>() {
            let mut shown = mark.shown.lock().unwrap();
            if *shown != needs || shown.is_none() {
                let waiting = needs.unwrap_or(0) > 0;
                let icon = Image::from_bytes(if waiting { TRAY_WAITING } else { TRAY }).ok();
                let _ = mark.tray.set_icon(icon);
                let _ = mark.tray.set_icon_as_template(true);
                let _ = mark.needs.set_text(match needs {
                    None => "Alpha is not answering".to_string(),
                    Some(0) => "Nothing needs you".to_string(),
                    Some(1) => "1 thing needs you".to_string(),
                    Some(n) => format!("{n} things need you"),
                });
                let _ = mark.needs.set_enabled(waiting);
                *shown = needs;
            }
        }
        thread::sleep(Duration::from_secs(4));
    });
}

fn menu_bar_mark(app: &AppHandle, core: &Core) -> tauri::Result<Mark> {
    let open = MenuItem::with_id(app, "open", "Open Alpha", true, None::<&str>)?;
    let needs = MenuItem::with_id(app, "needs", "Nothing needs you", false, None::<&str>)?;
    let activity = MenuItem::with_id(app, "activity", "Activity", true, None::<&str>)?;
    let settings = MenuItem::with_id(app, "settings", "Settings", true, None::<&str>)?;
    let quit = MenuItem::with_id(app, "quit", "Quit Alpha", true, None::<&str>)?;
    let line = || PredefinedMenuItem::separator(app);
    let menu = Menu::with_items(
        app,
        &[&open, &needs, &line()?, &activity, &settings, &line()?, &quit],
    )?;
    let core = core.clone();
    let tray = TrayIconBuilder::with_id("alpha")
        .icon(Image::from_bytes(TRAY)?)
        .icon_as_template(true)
        .tooltip("Alpha")
        .menu(&menu)
        .show_menu_on_left_click(true)
        .on_menu_event(move |app, event| match event.id().as_ref() {
            "open" => show(app, &core, None),
            "needs" => show(app, &core, Some("#/")),
            "activity" => show(app, &core, Some("#/activity")),
            "settings" => show(app, &core, Some("#/settings")),
            "quit" => app.exit(0),
            _ => {}
        })
        .build(app)?;
    Ok(Mark { tray, needs, shown: Mutex::new(None) })
}

fn main() {
    let core = Core::here();
    let started = core.clone();
    let reopen = core.clone();
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_window_state::Builder::default().build())
        .manage(core.clone())
        .invoke_handler(tauri::generate_handler![
            install_plan,
            install,
            install_quit,
            start_core
        ])
        .setup(move |app| {
            let handle = app.handle().clone();
            // a released Alpha not installed on this Mac yet, or newer than the one that is:
            // the Install window, and nothing else until it is done
            if install::wanted(&handle) {
                install::window(&handle)?;
                return Ok(());
            }
            build_window(&handle, &started)?;
            let (clicked, at) = (handle.clone(), started.clone());
            notify::start(move |place| show(&clicked, &at, Some(&place)));
            let mark = menu_bar_mark(&handle, &started)?;
            app.manage(mark);
            watch(handle, started.clone());
            Ok(())
        })
        .on_window_event(|window, event| {
            // closing the window hides it: Alpha keeps running in the menu bar
            if let WindowEvent::CloseRequested { api, .. } = event {
                if window.label() == "main" {
                    api.prevent_close();
                    let _ = window.hide();
                }
            }
        })
        .build(tauri::generate_context!())
        .expect("Alpha's window could not be made")
        .run(move |app, event| {
            if let RunEvent::Reopen { .. } = event {
                show(app, &reopen, None);
            }
        });
}
