//! The companion's window (Kenil's plan, step 3): a small see-through window that stays on top in
//! a corner of the screen, showing the core's #/companion page. The page says how big it is and
//! where it draws; the window keeps its bottom-right corner where it is as it grows, and lets a
//! click anywhere it does not draw through to whatever is behind it. It opens where it was left on
//! that display, or in the bottom-right corner; hidden from the menu bar, it stays hidden.

use std::path::PathBuf;
use std::sync::Mutex;
use std::thread;
use std::time::Duration;

use tauri::{
    AppHandle, LogicalSize, Manager, PhysicalPosition, Url, WebviewUrl, WebviewWindow,
    WebviewWindowBuilder,
};

pub const LABEL: &str = "companion";

/// Where the page draws, in the window's own points: [left, top, width, height] each; and
/// whether its box is open, when the whole window takes clicks and scrolls.
#[derive(Default)]
pub struct Hot(pub Mutex<Vec<[f64; 4]>>, pub Mutex<bool>);

fn file(app: &AppHandle, name: &str) -> Option<PathBuf> {
    let dir = app.path().app_config_dir().ok()?;
    let _ = std::fs::create_dir_all(&dir);
    Some(dir.join(name))
}

pub fn hidden(app: &AppHandle) -> bool {
    file(app, "companion-hidden").map(|f| f.exists()).unwrap_or(false)
}

pub fn window(app: &AppHandle) -> Option<WebviewWindow> {
    app.get_webview_window(LABEL)
}

/// Made once the core answers, unless the person hid it.
pub fn build(app: &AppHandle, url: Url) -> tauri::Result<WebviewWindow> {
    let w = WebviewWindowBuilder::new(app, LABEL, WebviewUrl::External(url))
        .title("Alpha")
        .inner_size(96.0, 96.0)
        .decorations(false)
        .transparent(true)
        .shadow(false)
        .always_on_top(true)
        .visible_on_all_workspaces(true)
        .skip_taskbar(true)
        .resizable(false)
        .accept_first_mouse(true)
        .focused(false)
        .visible(false)
        .build()?;
    place(app, &w);
    let _ = w.show();
    Ok(w)
}

/// Where it was left, if that display is still there; otherwise the bottom-right corner of the
/// main display's free area.
fn place(app: &AppHandle, w: &WebviewWindow) {
    let size = w.outer_size().unwrap_or_default();
    let saved: Option<serde_json::Value> = file(app, "companion-place.json")
        .and_then(|f| std::fs::read_to_string(f).ok())
        .and_then(|s| serde_json::from_str(&s).ok());
    let monitors = w.available_monitors().unwrap_or_default();
    if let Some(saved) = saved {
        let (right, bottom) = (saved["right"].as_i64(), saved["bottom"].as_i64());
        let shown = monitors.iter().find(|m| m.name().map(|n| n.as_str()) == saved["display"].as_str());
        if let (Some(right), Some(bottom), Some(m)) = (right, bottom, shown) {
            let (p, s) = (m.position(), m.size());
            let inside = right > i64::from(p.x)
                && right <= i64::from(p.x) + i64::from(s.width)
                && bottom > i64::from(p.y)
                && bottom <= i64::from(p.y) + i64::from(s.height);
            if inside {
                let x = right as i32 - size.width as i32;
                let y = bottom as i32 - size.height as i32;
                let _ = w.set_position(PhysicalPosition::new(x, y));
                return;
            }
        }
    }
    if let Ok(Some(m)) = w.primary_monitor() {
        let area = m.work_area();
        let margin = (16.0 * m.scale_factor()) as i32;
        let x = area.position.x + area.size.width as i32 - size.width as i32 - margin;
        let y = area.position.y + area.size.height as i32 - size.height as i32 - margin;
        let _ = w.set_position(PhysicalPosition::new(x, y));
    }
}

/// Kept as the corner it was left in, on its display, for next time.
pub fn remember(app: &AppHandle) {
    let Some(w) = window(app) else { return };
    let (Ok(pos), Ok(size)) = (w.outer_position(), w.outer_size()) else { return };
    let display = w.current_monitor().ok().flatten().and_then(|m| m.name().cloned());
    let saved = serde_json::json!({
        "display": display,
        "right": pos.x + size.width as i32,
        "bottom": pos.y + size.height as i32,
    });
    if let Some(f) = file(app, "companion-place.json") {
        let _ = std::fs::write(f, saved.to_string());
    }
}

/// The page's size, its bottom-right corner kept where it is.
pub fn layout(app: &AppHandle, width: f64, height: f64) {
    let Some(w) = window(app) else { return };
    let (Ok(pos), Ok(before)) = (w.outer_position(), w.outer_size()) else { return };
    let scale = w.scale_factor().unwrap_or(1.0);
    let (nw, nh) = ((width * scale).round() as i32, (height * scale).round() as i32);
    if nw == before.width as i32 && nh == before.height as i32 {
        return;
    }
    let right = pos.x + before.width as i32;
    let bottom = pos.y + before.height as i32;
    let _ = w.set_size(LogicalSize::new(width, height));
    let _ = w.set_position(PhysicalPosition::new(right - nw, bottom - nh));
}

/// Shown or hidden from the menu bar; hidden, it stays hidden at the next start.
pub fn set_shown(app: &AppHandle, shown: bool) {
    if let Some(f) = file(app, "companion-hidden") {
        if shown {
            let _ = std::fs::remove_file(f);
        } else {
            let _ = std::fs::write(f, "");
        }
    }
    if let Some(w) = window(app) {
        let _ = if shown { w.show() } else { w.hide() };
    }
}

/// ⌃⌥A: the companion in front with its box open, wherever the person is.
pub fn ask(app: &AppHandle) {
    let Some(w) = window(app) else { return };
    let _ = w.show();
    let _ = w.set_ignore_cursor_events(false);
    let _ = w.set_focus();
    let _ = w.eval("window.dispatchEvent(new Event('alpha-companion-open'))");
}

/// Clicks go to the companion only where it draws: the pointer is looked at a few times a second,
/// and the window takes clicks while it is over the face, the bubble or the box.
pub fn pass_clicks_through(app: AppHandle) {
    thread::spawn(move || {
        let mut taking: Option<bool> = None;
        loop {
            thread::sleep(Duration::from_millis(60));
            let Some(w) = window(&app) else { continue };
            let (Ok(cursor), Ok(pos)) = (app.cursor_position(), w.outer_position()) else {
                continue;
            };
            let scale = w.scale_factor().unwrap_or(1.0);
            let (x, y) = ((cursor.x - f64::from(pos.x)) / scale, (cursor.y - f64::from(pos.y)) / scale);
            let over = app
                .try_state::<Hot>()
                .map(|hot| {
                    *hot.1.lock().unwrap()
                        || hot.0.lock().unwrap().iter().any(|[l, t, wd, ht]| {
                            x >= *l && x <= l + wd && y >= *t && y <= t + ht
                        })
                })
                .unwrap_or(true);
            if taking != Some(over) {
                let _ = w.set_ignore_cursor_events(!over);
                taking = Some(over);
            }
        }
    });
}
