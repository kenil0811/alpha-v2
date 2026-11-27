//! Alpha installing itself on first open, with no Terminal. A released Alpha.app carries the core
//! inside it; opened on a Mac where it is not installed, or where an older one is, it shows one
//! window and runs its own install.sh, whose lines show there. Then it opens again from
//! Applications. A development build (no payload inside) never does this.

use std::io::{BufRead, BufReader};
use std::path::PathBuf;
use std::process::{Command, Stdio};
use std::thread;

use serde::Serialize;
use tauri::{AppHandle, Manager, WebviewUrl, WebviewWindowBuilder};

const LABEL: &str = "install";
const APP: &str = "/Applications/Alpha.app";

/// This app's bundle, when it is a released one with the core inside.
fn bundle() -> Option<PathBuf> {
    let exe = std::env::current_exe().ok()?;
    // …/Alpha.app/Contents/MacOS/alpha-mac
    let bundle = exe.parent()?.parent()?.parent()?.to_path_buf();
    bundle
        .join("Contents/Resources/app/VERSION")
        .exists()
        .then_some(bundle)
}

fn version_in(bundle: &PathBuf) -> String {
    std::fs::read_to_string(bundle.join("Contents/Resources/app/VERSION"))
        .map(|v| v.trim().to_string())
        .unwrap_or_default()
}

fn data_dir() -> PathBuf {
    PathBuf::from(std::env::var("HOME").unwrap_or_default())
        .join("Library/Application Support/Alpha")
}

/// The version installed on this Mac, if any: the one the installer wrote, else the app's own.
fn installed() -> Option<String> {
    let plist = PathBuf::from(std::env::var("HOME").unwrap_or_default())
        .join("Library/LaunchAgents/io.github.kenil0811.alpha.core.plist");
    if !plist.exists() {
        return None;
    }
    // an install before 0.4.3 wrote no version down: it counts as older than any release
    Some(
        std::fs::read_to_string(data_dir().join("version"))
            .map(|v| v.trim().to_string())
            .unwrap_or_else(|_| "an earlier version".to_string()),
    )
}

#[derive(Serialize)]
pub struct Plan {
    pub from: Option<String>,
    pub to: String,
}

pub fn plan(_app: &AppHandle) -> Plan {
    let to = bundle().map(|b| version_in(&b)).unwrap_or_default();
    Plan { from: installed(), to }
}

/// Whether this open should install: a released app, and no install yet, or an older one.
pub fn wanted(_app: &AppHandle) -> bool {
    let Some(b) = bundle() else { return false };
    match installed() {
        None => true,
        Some(have) => have != version_in(&b),
    }
}

pub fn window(app: &AppHandle) -> tauri::Result<()> {
    WebviewWindowBuilder::new(app, LABEL, WebviewUrl::App("install.html".into()))
        .title("Alpha")
        .inner_size(560.0, 420.0)
        .resizable(false)
        .title_bar_style(tauri::TitleBarStyle::Overlay)
        .hidden_title(true)
        .accept_first_mouse(true)
        .center()
        .build()?;
    Ok(())
}

fn tell(app: &AppHandle, js: String) {
    if let Some(w) = app.get_webview_window(LABEL) {
        let _ = w.eval(js);
    }
}

/// Runs the bundled install.sh with this app as the source, its lines shown in the window; once
/// it is done, Alpha opens again from Applications and this one leaves.
pub fn run(app: AppHandle) {
    thread::spawn(move || {
        let Some(b) = bundle() else { return };
        let script = b.join("Contents/Resources/app/install.sh");
        let child = Command::new("/bin/sh")
            .arg(&script)
            .arg("--from-app")
            .arg(&b)
            .env("PATH", "/usr/bin:/bin:/usr/sbin:/sbin")
            .stdin(Stdio::null())
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .spawn();
        let mut child = match child {
            Ok(c) => c,
            Err(e) => {
                tell(&app, format!("installEnded(false, {})", serde_json::json!(format!("The installer could not start: {e}"))));
                return;
            }
        };
        let out = child.stdout.take();
        let err = child.stderr.take();
        let (a, b2) = (app.clone(), app.clone());
        let t1 = thread::spawn(move || {
            if let Some(out) = out {
                for line in BufReader::new(out).lines().map_while(Result::ok) {
                    if !line.trim().is_empty() {
                        tell(&a, format!("addLine({})", serde_json::json!(line)));
                    }
                }
            }
        });
        let t2 = thread::spawn(move || {
            if let Some(err) = err {
                for line in BufReader::new(err).lines().map_while(Result::ok) {
                    if !line.trim().is_empty() {
                        tell(&b2, format!("addLine({})", serde_json::json!(line)));
                    }
                }
            }
        });
        let status = child.wait();
        let _ = t1.join();
        let _ = t2.join();
        let ok = status.map(|s| s.success()).unwrap_or(false);
        if ok {
            tell(&app, "installEnded(true, 'Done. Alpha opens now.')".to_string());
            // the installed Alpha takes over; this one leaves once it is on its way
            let _ = Command::new("/bin/sh")
                .arg("-c")
                .arg(format!("sleep 1; /usr/bin/open '{APP}'"))
                .spawn();
            thread::sleep(std::time::Duration::from_millis(1500));
            app.exit(0);
        } else {
            tell(
                &app,
                "installEnded(false, 'It did not finish. The lines above say where; send them to Kenil.')"
                    .to_string(),
            );
        }
    });
}
