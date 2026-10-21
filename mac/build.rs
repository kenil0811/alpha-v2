fn main() {
    // the shell's own commands, so a capability can let the core's pages call them by name
    tauri_build::try_build(tauri_build::Attributes::new().app_manifest(
        tauri_build::AppManifest::new().commands(&["show_main", "companion_layout", "companion_hot", "install_plan", "install", "install_quit", "start_core"]),
    ))
    .expect("the shell's build");
}
