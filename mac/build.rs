fn main() {
    // the shell's own commands, so a capability can let the core's pages call them by name
    tauri_build::try_build(tauri_build::Attributes::new().app_manifest(
        tauri_build::AppManifest::new().commands(&["install", "install_plan", "install_quit", "start_core"]),
    ))
    .expect("the shell's build");
}
