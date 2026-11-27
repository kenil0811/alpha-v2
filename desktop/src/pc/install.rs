//! Alpha installing itself on a Windows PC, from its own Install window, with no terminal: it
//! checks the PC, turns WSL on if it is off (Windows' own administrator prompt, once, then a
//! restart, after which Alpha carries on by itself), brings in Alpha's Linux from the file the
//! setup program put beside it, seals the key to its secrets with Windows, adds the two
//! start-at-sign-in entries (the engine's starter, and this app quietly), and starts Alpha.

use std::path::PathBuf;
use std::process::Command;
use std::os::windows::process::CommandExt;
use std::thread;
use std::time::Duration;

use serde::Serialize;
use tauri::{AppHandle, Manager, WebviewUrl, WebviewWindowBuilder};
use windows_sys::Win32::Storage::FileSystem::GetDiskFreeSpaceExW;
use windows_sys::Win32::System::SystemInformation::IMAGE_FILE_MACHINE_ARM64;
use windows_sys::Win32::System::Threading::{GetCurrentProcess, IsWow64Process2};

use super::{data_dir, distro_here, engine, linux, linux_with, start_engine, wsl, DISTRO, NO_WINDOW};

const LABEL: &str = "install";
const RUN: &str = r"HKCU\Software\Microsoft\Windows\CurrentVersion\Run";
const RUN_ONCE: &str = r"HKCU\Software\Microsoft\Windows\CurrentVersion\RunOnce";
/// Windows 10 22H2 is build 19045; anything older is not promised.
const OLDEST_BUILD: u32 = 19045;
const FREE_GB: u64 = 4;

/// The file of Alpha's Linux and its version, beside this app when the setup program put it.
fn bundled(app: &AppHandle) -> Option<(PathBuf, String)> {
    let dir = app.path().resource_dir().ok()?;
    let image = dir.join("alpha-linux.tar.gz");
    let version = std::fs::read_to_string(dir.join("VERSION")).ok()?.trim().to_string();
    image.exists().then_some((image, version))
}

/// The version installed on this PC, if any.
fn installed() -> Option<String> {
    let v = std::fs::read_to_string(data_dir().join("version")).ok()?;
    distro_here().then(|| v.trim().to_string())
}

#[derive(Serialize)]
pub struct Plan {
    pub from: Option<String>,
    pub to: String,
    pub windows: bool,
    pub carry_on: bool, // after the restart: the window goes on by itself
    pub saved: Option<String>, // a fresh install: the day the newest saved data is from
}

pub fn plan(app: &AppHandle) -> Plan {
    let to = bundled(app).map(|(_, v)| v).unwrap_or_default();
    let from = installed();
    let saved = if from.is_none() { newest_saved().map(|(_, day)| day) } else { None };
    Plan { from, to, windows: true, carry_on: carrying_on(), saved }
}

/// Where an uninstall keeps the person's data: on this PC, beside the key that opens its secrets,
/// never in a folder a cloud may copy (Documents often is).
fn saved_dir() -> PathBuf {
    data_dir().join("saved")
}

/// The newest data an uninstall saved, and its day (`Alpha data 2026-11-27.tar.gz`).
fn newest_saved() -> Option<(PathBuf, String)> {
    let mut found: Vec<(PathBuf, String)> = std::fs::read_dir(saved_dir())
        .ok()?
        .filter_map(|e| e.ok())
        .filter_map(|e| {
            let name = e.file_name().to_string_lossy().to_string();
            let day = name.strip_prefix("Alpha data ")?.strip_suffix(".tar.gz")?.to_string();
            Some((e.path(), day))
        })
        .collect();
    found.sort_by(|a, b| a.1.cmp(&b.1));
    found.pop()
}

/// After the restart that turned WSL on, the install remembers whether to bring the data back.
fn bringing_back() -> bool {
    std::env::args().any(|a| a == "--bring-back")
}

/// Whether this open should install: the setup program's copy, and no install yet, or another.
pub fn wanted(app: &AppHandle) -> bool {
    let Some((_, v)) = bundled(app) else { return false };
    installed().as_deref() != Some(v.as_str())
}

/// After the restart that turned WSL on, the install carries on by itself.
pub fn carrying_on() -> bool {
    std::env::args().any(|a| a == "--continue-install")
}

pub fn window(app: &AppHandle) -> tauri::Result<()> {
    WebviewWindowBuilder::new(app, LABEL, WebviewUrl::App("install.html".into()))
        .title("Alpha")
        .inner_size(560.0, 520.0)
        .resizable(false)
        .center()
        .build()?;
    Ok(())
}

/// Installed with no window (`--install-quietly`, GitHub's machine): the lines go to a log.
pub fn quietly() -> bool {
    std::env::args().any(|a| a == "--install-quietly")
}

fn log(line: &str) {
    use std::io::Write;
    let _ = std::fs::create_dir_all(data_dir());
    if let Ok(mut f) = std::fs::OpenOptions::new().create(true).append(true).open(data_dir().join("install.log")) {
        let _ = writeln!(f, "{line}");
    }
}

fn tell(app: &AppHandle, js: String) {
    if let Some(w) = app.get_webview_window(LABEL) {
        let _ = w.eval(js);
    }
}

fn say(app: &AppHandle, line: &str) {
    if quietly() {
        return log(line);
    }
    tell(app, format!("addLine({})", serde_json::json!(line)));
}

/// The step the Install window ticks to: check, wsl, save, linux, data, key, start.
fn step(app: &AppHandle, key: &str) {
    if !quietly() {
        tell(app, format!("installStep({})", serde_json::json!(key)));
    }
}

fn ended(app: &AppHandle, state: &str, words: &str) {
    if quietly() {
        log(&format!("{state}: {words}"));
        if state != "done" {
            app.exit(1);
        }
        return;
    }
    tell(app, format!("installEnded({}, {})", serde_json::json!(state), serde_json::json!(words)));
}

/// Windows' build number, from the registry.
fn build() -> u32 {
    Command::new("reg.exe")
        .args(["query", r"HKLM\SOFTWARE\Microsoft\Windows NT\CurrentVersion", "/v", "CurrentBuildNumber"])
        .creation_flags(NO_WINDOW)
        .output()
        .ok()
        .and_then(|o| {
            String::from_utf8_lossy(&o.stdout)
                .split_whitespace()
                .last()
                .and_then(|n| n.parse().ok())
        })
        .unwrap_or(0)
}

/// An Arm PC, even when this app runs on it as Intel code.
fn arm() -> bool {
    let (mut process, mut native) = (0u16, 0u16);
    // SAFETY: two plain numbers Windows fills in for this process.
    unsafe { IsWow64Process2(GetCurrentProcess(), &mut process, &mut native) != 0 && native == IMAGE_FILE_MACHINE_ARM64 }
}

fn free_gb() -> u64 {
    let path: Vec<u16> = format!("{}\0", data_dir().parent().map(|p| p.display().to_string()).unwrap_or_default())
        .encode_utf16()
        .collect();
    let mut free = 0u64;
    // SAFETY: a path and a number Windows fills in.
    unsafe { GetDiskFreeSpaceExW(path.as_ptr(), &mut free, std::ptr::null_mut(), std::ptr::null_mut()) };
    free / (1 << 30)
}

/// Whether WSL is on and up to date enough to run Alpha's Linux.
fn wsl_ready() -> bool {
    wsl().arg("--version").output().map(|o| o.status.success()).unwrap_or(false)
}

/// The administrator prompt is Windows' own, for its own WSL tool: once per PC.
fn turn_wsl_on() -> bool {
    Command::new("powershell.exe")
        .args([
            "-NoProfile",
            "-Command",
            "try { $p = Start-Process -FilePath wsl.exe -ArgumentList '--install','--no-distribution' -Verb RunAs -WindowStyle Hidden -Wait -PassThru; exit $p.ExitCode } catch { exit 1 }",
        ])
        .creation_flags(NO_WINDOW)
        .status()
        .map(|s| s.success())
        .unwrap_or(false)
}

fn reg(args: &[&str]) -> bool {
    Command::new("reg.exe").args(args).creation_flags(NO_WINDOW).status().map(|s| s.success()).unwrap_or(false)
}

/// The person's name as Windows shows it, else their account's.
fn person() -> String {
    Command::new("powershell.exe")
        .args([
            "-NoProfile",
            "-Command",
            "try { Add-Type -AssemblyName System.DirectoryServices.AccountManagement; ([System.DirectoryServices.AccountManagement.UserPrincipal]::Current).DisplayName } catch { }",
        ])
        .creation_flags(NO_WINDOW)
        .output()
        .ok()
        .map(|o| String::from_utf8_lossy(&o.stdout).trim().to_string())
        .filter(|n| !n.is_empty())
        .unwrap_or_else(|| std::env::var("USERNAME").unwrap_or_default())
}

fn answering() -> bool {
    ureq::get("http://127.0.0.1:4700/api/health")
        .timeout(Duration::from_secs(4))
        .call()
        .is_ok()
}

/// The install: `bring_back` puts the newest saved data in, on a fresh install.
pub fn run(app: AppHandle, bring_back: bool) {
    let bring_back = bring_back || bringing_back();
    thread::spawn(move || {
        let Some((image, version)) = bundled(&app) else { return };
        let Ok(me) = std::env::current_exe() else { return };
        let me = me.display().to_string();

        step(&app, "check");
        say(&app, "Checking this PC");
        if arm() {
            return ended(&app, "failed", "This PC has an Arm chip; Alpha runs on Intel and AMD PCs for now.");
        }
        let b = build();
        if b < OLDEST_BUILD {
            return ended(&app, "failed", "Alpha needs Windows 11, or Windows 10 with its 22H2 update. Update Windows, then open Alpha again.");
        }
        if free_gb() < FREE_GB {
            return ended(&app, "failed", "Alpha needs about 4 GB free on this PC's disk. Make room, then open Alpha again.");
        }

        if !wsl_ready() {
            step(&app, "wsl");
            say(&app, "Turning on Windows Subsystem for Linux: Windows asks you once");
            if !turn_wsl_on() {
                return ended(&app, "failed", "Windows did not turn it on. Press Install to ask again; Windows asks for an administrator's yes.");
            }
            // after the restart, this window opens by itself and carries on
            let again = if bring_back { " --bring-back" } else { "" };
            reg(&["add", RUN_ONCE, "/v", "AlphaInstall", "/t", "REG_SZ", "/d", &format!("\"{me}\" --continue-install{again}"), "/f"]);
            if !wsl_ready() {
                return ended(&app, "restart", "Windows needs a restart to finish. Alpha carries on by itself when you sign in again.");
            }
        }

        // an update: Alpha's Linux made new from this setup's, the person's data carried over
        // (saved first, beside the key, and put back after); the key Windows keeps stays. The
        // readers' downloads (the reading browser, the document reader) come again by themselves.
        let mut carried: Option<Vec<u8>> = None;
        if distro_here() && installed().as_deref() != Some(version.as_str()) {
            step(&app, "save");
            say(&app, "Saving your data before updating");
            stop_others();
            let out = linux("systemctl stop alpha; tar -czf - -C /home/alpha --exclude=data/browsers --exclude=data/envs data").output();
            match out {
                Ok(o) if o.status.success() && !o.stdout.is_empty() => {
                    let _ = std::fs::write(data_dir().join("before-update.tar.gz"), &o.stdout);
                    carried = Some(o.stdout);
                }
                _ => return ended(&app, "failed", "Your data could not be saved before updating, so nothing was changed."),
            }
            say(&app, "Taking out the old Alpha's Linux");
            let _ = wsl().args(["--unregister", DISTRO]).status();
        }

        if !distro_here() {
            step(&app, "linux");
            say(&app, "Bringing in Alpha's Linux: a few minutes");
            let to = data_dir().join("linux");
            let _ = std::fs::create_dir_all(&to);
            let out = wsl()
                .arg("--import")
                .arg(DISTRO)
                .arg(&to)
                .arg(&image)
                .args(["--version", "2"])
                .output();
            let ok = out.as_ref().map(|o| o.status.success()).unwrap_or(false);
            if !ok {
                let said = out
                    .map(|o| format!("{}{}", String::from_utf8_lossy(&o.stdout), String::from_utf8_lossy(&o.stderr)))
                    .unwrap_or_default();
                if said.contains("HCS_E_HYPERV_NOT_INSTALLED") || said.to_lowercase().contains("virtualization") {
                    return ended(&app, "failed", "This PC has virtualization turned off. It is turned on in the PC's firmware (BIOS) settings; then open Alpha again.");
                }
                say(&app, said.trim());
                return ended(&app, "failed", "Alpha's Linux did not come in. The lines above say why; send them to Kenil.");
            }
        }

        // a fresh install: the data an uninstall saved, put in as an update's is
        let saved = if carried.is_none() && bring_back { newest_saved() } else { None };
        let from_saved = saved.is_some();
        if let Some((file, day)) = saved {
            say(&app, &format!("Bringing back your data saved on {day}"));
            match std::fs::read(&file) {
                Ok(data) => carried = Some(data),
                Err(_) => return ended(&app, "failed", "Your saved data could not be read, so nothing was brought back. Open Alpha again to try once more."),
            }
        }

        if let Some(data) = carried {
            step(&app, "data");
            say(&app, "Putting your data back");
            let back = linux_with(
                "rm -rf /home/alpha/data && tar -xzf - -C /home/alpha && chown -R alpha:alpha /home/alpha/data",
                &data,
            );
            if !back.map(|o| o.status.success()).unwrap_or(false) {
                let kept = if from_saved { "in AlphaData\\saved" } else { "in AlphaData as before-update.tar.gz" };
                return ended(&app, "failed", &format!("Your data did not go back in. It is kept {kept}; send this to Kenil."));
            }
            // saved data whose secrets the key here cannot open (another PC's, or the key gone):
            // the rest comes back, and the accounts are signed in to again
            let has_secrets = linux("test -f /home/alpha/data/secrets.enc").status().map(|s| s.success()).unwrap_or(false);
            if from_saved && has_secrets && !engine::opens_secrets() {
                let _ = linux("rm -f /home/alpha/data/secrets.enc").status();
                say(&app, "Your accounts' sign-ins could not come back with it: sign in to them again under Connections.");
            }
        }

        step(&app, "key");
        say(&app, "Sealing the key to Alpha's secrets with Windows");
        if let Err(e) = engine::make_key() {
            return ended(&app, "failed", &e);
        }
        let yaml = format!("owner: {}\nprepare_readers: true\n", serde_json::json!(person()));
        let _ = linux_with(
            "[ -f /home/alpha/data/alpha.yaml ] || { cat > /home/alpha/data/alpha.yaml; chown alpha:alpha /home/alpha/data/alpha.yaml; }",
            yaml.as_bytes(),
        );

        step(&app, "start");
        say(&app, "Starting with Windows: Alpha's engine, and Alpha by the clock");
        reg(&["add", RUN, "/v", "Alpha engine", "/t", "REG_SZ", "/d", &format!("\"{me}\" --engine"), "/f"]);
        reg(&["add", RUN, "/v", "Alpha", "/t", "REG_SZ", "/d", &format!("\"{me}\" --quietly"), "/f"]);
        reg(&["delete", RUN_ONCE, "/v", "AlphaInstall", "/f"]);

        say(&app, "Starting Alpha");
        start_engine();
        let mut up = false;
        for _ in 0..90 {
            if answering() {
                up = true;
                break;
            }
            thread::sleep(Duration::from_secs(2));
        }
        if !up {
            let said = linux("journalctl -u alpha -n 20 --no-pager -o cat").output().map(|o| String::from_utf8_lossy(&o.stdout).to_string()).unwrap_or_default();
            for l in said.lines().filter(|l| !l.contains("t=")) {
                say(&app, l);
            }
            return ended(&app, "failed", "Alpha did not start. The lines above say why; send them to Kenil.");
        }
        let _ = std::fs::write(data_dir().join("version"), &version);
        ended(&app, "done", "Done. Alpha opens now.");
        if quietly() {
            return app.exit(0);
        }
        // this app again, as a person opens it, and this install window leaves
        let _ = Command::new(&me).creation_flags(NO_WINDOW).spawn();
        thread::sleep(Duration::from_millis(1500));
        app.exit(0);
    });
}

/// Alpha's other processes (the engine's starter, the app by the clock), stopped so nothing starts
/// Alpha's Linux again while it is taken out.
fn stop_others() {
    let _ = Command::new("taskkill.exe")
        .args(["/F", "/IM", "Alpha.exe", "/FI", &format!("PID ne {}", std::process::id())])
        .creation_flags(NO_WINDOW)
        .status();
}

/// The restart Windows needs after turning WSL on, from the window's own button.
pub fn restart() {
    let _ = Command::new("shutdown.exe").args(["/r", "/t", "5"]).creation_flags(NO_WINDOW).spawn();
}

/// Uninstalling (the setup program's uninstaller runs `Alpha.exe --uninstall` first): the data
/// saved as an archive on this PC (AlphaData\saved), which a later install offers to bring back
/// with the key Windows still keeps; then Alpha's Linux removed, the start-at-sign-in entries and
/// this PC's pairing with it. With `delete` (the uninstaller's Delete the application data,
/// ticked), nothing is saved and everything Alpha kept on this PC goes, the key with it.
pub fn uninstall(delete: bool) {
    // the engine's starter and the app go first, so nothing starts Alpha's Linux again
    stop_others();
    if delete {
        if distro_here() {
            let _ = wsl().args(["--unregister", DISTRO]).status();
        }
        reg(&["delete", RUN, "/v", "Alpha engine", "/f"]);
        reg(&["delete", RUN, "/v", "Alpha", "/f"]);
        super::bridge::forget();
        let _ = std::fs::remove_dir_all(data_dir());
        return;
    }
    let docs = saved_dir();
    if distro_here() {
        let _ = std::fs::create_dir_all(&docs);
        let _ = linux("systemctl stop alpha").status();
        let stamp = Command::new("powershell.exe")
            .args(["-NoProfile", "-Command", "Get-Date -Format yyyy-MM-dd"])
            .creation_flags(NO_WINDOW)
            .output()
            .map(|o| String::from_utf8_lossy(&o.stdout).trim().to_string())
            .unwrap_or_default();
        if let Ok(out) = linux("tar -czf - -C /home/alpha --exclude=data/browsers --exclude=data/envs data").output() {
            if out.status.success() && !out.stdout.is_empty() {
                let _ = std::fs::write(docs.join(format!("Alpha data {stamp}.tar.gz")), &out.stdout);
            }
        }
        let _ = wsl().args(["--unregister", DISTRO]).status();
    }
    reg(&["delete", RUN, "/v", "Alpha engine", "/f"]);
    reg(&["delete", RUN, "/v", "Alpha", "/f"]);
    let _ = std::fs::remove_file(data_dir().join("version"));
    super::bridge::forget();
}
