//! Notifications from Alpha on Windows: reminders and cards that need the person, as Windows'
//! own notifications with Alpha's name and icon. A click brings Alpha forward.

use std::sync::OnceLock;

use tauri::AppHandle;
use tauri_plugin_notification::NotificationExt;

static APP: OnceLock<AppHandle> = OnceLock::new();

pub fn start(app: &AppHandle) {
    let _ = APP.set(app.clone());
}

pub fn show(_id: &str, title: &str, subtitle: Option<&str>, body: &str, _open: &str) {
    let Some(app) = APP.get() else { return };
    let words = match subtitle {
        Some(s) if !s.is_empty() => format!("{s}\n{body}"),
        _ => body.to_string(),
    };
    let _ = app.notification().builder().title(title).body(words).show();
}
