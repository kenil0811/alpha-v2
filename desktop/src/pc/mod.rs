//! Alpha on a Windows PC: its engine is the servers' Linux Alpha, inside the Linux Windows runs
//! for it (WSL2, a distribution called Alpha). This app is its window, its icon by the clock and
//! its notifications, and it carries Alpha Bridge's code for the PC's own folders and browser
//! (bridge.rs); with `--engine` it is the engine's starter instead (engine.rs), with no window at
//! all. Every Linux command is run with no console window.

pub mod bridge;
pub mod engine;
pub mod install;
pub mod notify;

use std::io::Write;
use std::os::windows::process::CommandExt;
use std::path::PathBuf;
use std::process::{Command, Output, Stdio};
use std::sync::Mutex;

/// A program started with no console window (CREATE_NO_WINDOW).
pub const NO_WINDOW: u32 = 0x0800_0000;
/// Alpha's own Linux, by its name in WSL.
pub const DISTRO: &str = "Alpha";

/// `wsl.exe`, quiet, its own words in UTF-8.
pub fn wsl() -> Command {
    let mut c = Command::new("wsl.exe");
    c.env("WSL_UTF8", "1").creation_flags(NO_WINDOW);
    c
}

/// A shell command as root inside Alpha's Linux. `--exec` hands `sh` the script as it is: through
/// `--`, Linux's own shell reads the line first and fills in every `$` before `sh` sees it.
pub fn linux(script: &str) -> Command {
    let mut c = wsl();
    c.args(["-d", DISTRO, "-u", "root", "--exec", "sh", "-c", script]);
    c
}

/// The same, with words handed in on its input (a key, a file), and what it said back.
pub fn linux_with(script: &str, input: &[u8]) -> std::io::Result<Output> {
    let mut child = linux(script)
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()?;
    if let Some(mut stdin) = child.stdin.take() {
        stdin.write_all(input)?;
    }
    child.wait_with_output()
}

/// Where Alpha keeps its own things on this PC: the Linux's disk, the sealed key, the version.
/// Beside the app's own folder (%LOCALAPPDATA%\Alpha), never in it, so uninstalling the app
/// never takes them unasked.
pub fn data_dir() -> PathBuf {
    PathBuf::from(std::env::var("LOCALAPPDATA").unwrap_or_default()).join("AlphaData")
}

/// Whether Alpha's Linux is on this PC.
pub fn distro_here() -> bool {
    wsl()
        .args(["-l", "-q"])
        .output()
        .map(|o| {
            String::from_utf8_lossy(&o.stdout)
                .lines()
                .any(|l| l.trim().trim_matches('\u{feff}').eq_ignore_ascii_case(DISTRO))
        })
        .unwrap_or(false)
}

static TOKEN: Mutex<Option<String>> = Mutex::new(None);

/// The per-install token the core wrote inside Linux; kept once read, as it never changes.
pub fn token() -> Option<String> {
    if let Some(t) = TOKEN.lock().ok()?.clone() {
        return Some(t);
    }
    let out = linux("cat /home/alpha/data/token 2>/dev/null").output().ok()?;
    let t = String::from_utf8_lossy(&out.stdout).trim().to_string();
    if t.is_empty() {
        return None;
    }
    *TOKEN.lock().ok()? = Some(t.clone());
    Some(t)
}

/// The engine's starter, started again (or for the first time), on its own.
pub fn start_engine() -> bool {
    let Ok(me) = std::env::current_exe() else { return false };
    Command::new(me)
        .arg("--engine")
        .creation_flags(NO_WINDOW)
        .stdin(Stdio::null())
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .spawn()
        .is_ok()
}

/// An update from a file Kenil made (`pnpm server pc`): the servers' own signed release, taken by
/// the servers' own update inside Alpha's Linux, which checks his signature, backs up first, and
/// goes back by itself if the new one does not start. What it said, in a few words.
pub fn update_from(file: &std::path::Path) -> Result<String, String> {
    let bytes = std::fs::read(file).map_err(|e| format!("The file could not be read: {e}"))?;
    let out = linux_with(
        "rm -rf /tmp/alpha-update && mkdir -p /tmp/alpha-update && tar -xf - -C /tmp/alpha-update && f=$(ls /tmp/alpha-update/alpha-server-*.tar.gz | head -1) && [ -f \"$f.sig\" ] && alpha update \"$f\" \"$f.sig\" 2>&1; s=$?; rm -rf /tmp/alpha-update; exit $s",
        &bytes,
    )
    .map_err(|e| format!("Alpha's Linux did not answer: {e}"))?;
    let said = String::from_utf8_lossy(&out.stdout).trim().lines().last().unwrap_or_default().to_string();
    if out.status.success() {
        Ok(said)
    } else if said.is_empty() {
        Err("That is not an Alpha update file.".into())
    } else {
        Err(said)
    }
}

/// A report for Kenil on the Desktop: versions, health and shapes, never rows (the alpha
/// command's own report, made inside Linux).
pub fn report() -> Option<PathBuf> {
    let out = linux(
        "cd /opt/alpha/current/core && ALPHA_HOME=/home/alpha/data /opt/alpha/node/bin/node src/cli.ts report /tmp/alpha-report.txt >/dev/null 2>&1; cat /tmp/alpha-report.txt",
    )
    .output()
    .ok()?;
    if out.stdout.is_empty() {
        return None;
    }
    let desktop = PathBuf::from(std::env::var("USERPROFILE").unwrap_or_default()).join("Desktop");
    let file = desktop.join("Alpha report.txt");
    std::fs::write(&file, &out.stdout).ok()?;
    Some(file)
}
