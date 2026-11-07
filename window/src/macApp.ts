// Alpha's Mac app around this page, when there is one (mac/), known by Tauri's own bridge.
export const inMacApp = (): boolean =>
  typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window
