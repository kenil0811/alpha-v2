//! The engine's starter (`Alpha.exe --engine`, started at sign-in, no window): it hands Alpha's
//! Linux the key to its secrets, which Windows keeps sealed for this person, starts Alpha there,
//! and holds a hidden link open so Windows never stops that Linux while it is idle; if the link
//! ends (the Linux stopped), it does it all again. While the PC is plugged in it keeps the PC
//! awake, as the Mac keeps itself awake. One starter at a time.

use std::process::{Child, Stdio};
use std::thread;
use std::time::Duration;

use base64::Engine as _;
use windows_sys::Win32::Foundation::{GetLastError, LocalFree, ERROR_ALREADY_EXISTS};
use windows_sys::Win32::Security::Cryptography::{
    CryptProtectData, CryptUnprotectData, CRYPT_INTEGER_BLOB,
};
use windows_sys::Win32::System::Power::{
    GetSystemPowerStatus, SetThreadExecutionState, ES_CONTINUOUS, ES_SYSTEM_REQUIRED,
    SYSTEM_POWER_STATUS,
};
use windows_sys::Win32::System::Threading::CreateMutexW;

use super::{data_dir, linux, linux_with, wsl, DISTRO};

const KEY: &str = "secrets.key";

/// Bytes sealed by Windows for this person on this PC (DPAPI): a copy elsewhere opens nothing.
pub fn seal(data: &[u8]) -> Option<Vec<u8>> {
    let input = CRYPT_INTEGER_BLOB { cbData: data.len() as u32, pbData: data.as_ptr() as *mut u8 };
    let mut out = CRYPT_INTEGER_BLOB { cbData: 0, pbData: std::ptr::null_mut() };
    // SAFETY: the blobs point at memory that lives through the call; Windows allocates `out`,
    // which is copied and freed here.
    unsafe {
        let ok = CryptProtectData(
            &input,
            std::ptr::null(),
            std::ptr::null(),
            std::ptr::null(),
            std::ptr::null(),
            0,
            &mut out,
        );
        if ok == 0 {
            return None;
        }
        let v = std::slice::from_raw_parts(out.pbData, out.cbData as usize).to_vec();
        LocalFree(out.pbData as _);
        Some(v)
    }
}

pub fn unseal(data: &[u8]) -> Option<Vec<u8>> {
    let input = CRYPT_INTEGER_BLOB { cbData: data.len() as u32, pbData: data.as_ptr() as *mut u8 };
    let mut out = CRYPT_INTEGER_BLOB { cbData: 0, pbData: std::ptr::null_mut() };
    // SAFETY: as in seal.
    unsafe {
        let ok = CryptUnprotectData(
            &input,
            std::ptr::null_mut(),
            std::ptr::null(),
            std::ptr::null(),
            std::ptr::null(),
            0,
            &mut out,
        );
        if ok == 0 {
            return None;
        }
        let v = std::slice::from_raw_parts(out.pbData, out.cbData as usize).to_vec();
        LocalFree(out.pbData as _);
        Some(v)
    }
}

/// Whether the key Windows keeps here opens the secrets in Alpha's data, as data brought back
/// from a saved archive needs: with no key kept, or another PC's data, they cannot be read.
pub fn opens_secrets() -> bool {
    let Ok(sealed) = std::fs::read(data_dir().join(KEY)) else { return false };
    let Some(key) = unseal(&sealed) else { return false };
    linux_with(OPENS, &key).map(|o| o.status.success()).unwrap_or(false)
}

const OPENS: &str = "cd /home/alpha/data && /opt/alpha/node/bin/node -e \"const f=require('fs'),c=require('crypto');const k=Buffer.from(f.readFileSync(0,'utf8').trim(),'base64');const s=JSON.parse(f.readFileSync('secrets.enc','utf8'));const d=c.createDecipheriv('aes-256-gcm',k,Buffer.from(s.iv,'base64'));d.setAuthTag(Buffer.from(s.tag,'base64'));d.update(Buffer.from(s.data,'base64'));d.final()\"";

/// The key to Alpha's secrets, made once at install: 32 random bytes from Linux, as the servers
/// make theirs, kept on this PC only sealed by Windows.
pub fn make_key() -> Result<(), String> {
    let file = data_dir().join(KEY);
    if file.exists() {
        return Ok(());
    }
    let out = linux("head -c 32 /dev/urandom | base64 -w0")
        .output()
        .map_err(|e| format!("Linux did not answer: {e}"))?;
    let key = String::from_utf8_lossy(&out.stdout).trim().to_string();
    if base64::engine::general_purpose::STANDARD.decode(&key).map(|k| k.len()) != Ok(32) {
        return Err("The key to Alpha's secrets was not made.".into());
    }
    let sealed = seal(key.as_bytes()).ok_or("Windows did not seal the key to Alpha's secrets.")?;
    std::fs::create_dir_all(data_dir()).map_err(|e| e.to_string())?;
    std::fs::write(&file, sealed).map_err(|e| e.to_string())
}

/// The key handed in to a file in Linux's memory alone, then Alpha started there.
pub fn hand_in_and_start() -> bool {
    let Ok(sealed) = std::fs::read(data_dir().join(KEY)) else { return false };
    let Some(key) = unseal(&sealed) else { return false };
    linux_with(
        "umask 077; mkdir -p /run/alpha; cat > /run/alpha/secrets; systemctl start alpha",
        &key,
    )
    .map(|o| o.status.success())
    .unwrap_or(false)
}

/// The hidden link that keeps Windows from stopping Alpha's Linux while it is idle.
fn hold() -> Option<Child> {
    wsl()
        .args(["-d", DISTRO, "-u", "root", "--", "sleep", "infinity"])
        .stdin(Stdio::null())
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .spawn()
        .ok()
}

/// Kept awake while plugged in; on battery, Windows' own sleep stands.
fn awake() {
    let mut s: SYSTEM_POWER_STATUS = unsafe { std::mem::zeroed() };
    // SAFETY: `s` is a plain struct Windows fills in.
    let plugged = unsafe { GetSystemPowerStatus(&mut s) } != 0 && s.ACLineStatus == 1;
    // SAFETY: a flag for this thread, held until the next call changes it.
    unsafe {
        SetThreadExecutionState(if plugged { ES_CONTINUOUS | ES_SYSTEM_REQUIRED } else { ES_CONTINUOUS });
    }
}

pub fn run() {
    // one starter at a time: a second one leaves at once
    let name: Vec<u16> = "Local\\AlphaEngine\0".encode_utf16().collect();
    // SAFETY: a named mutex, kept for as long as this process runs.
    let _one = unsafe { CreateMutexW(std::ptr::null(), 1, name.as_ptr()) };
    if unsafe { GetLastError() } == ERROR_ALREADY_EXISTS {
        return;
    }
    loop {
        hand_in_and_start();
        let Some(mut link) = hold() else {
            thread::sleep(Duration::from_secs(10));
            continue;
        };
        loop {
            awake();
            if matches!(link.try_wait(), Ok(Some(_)) | Err(_)) {
                break;
            }
            thread::sleep(Duration::from_secs(30));
        }
        thread::sleep(Duration::from_secs(5));
    }
}
