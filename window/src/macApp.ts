// Alpha's Mac app around this page, when there is one (mac/): its commands, reached through
// Tauri's own bridge. In a browser there is no app, and each call does nothing.
type Bridge = { invoke: (cmd: string, args?: Record<string, unknown>) => Promise<unknown> }

const bridge = (): Bridge | undefined =>
  (window as unknown as { __TAURI_INTERNALS__?: Bridge }).__TAURI_INTERNALS__

export const inMacApp = (): boolean => !!bridge()

export function shell(cmd: string, args?: Record<string, unknown>): Promise<unknown> {
  const b = bridge()
  return b ? b.invoke(cmd, args).catch(() => null) : Promise.resolve(null)
}

// Alpha's window at a place in it: the app's own window, or this tab in a browser.
export function openInAlpha(hash: string): void {
  if (inMacApp()) void shell('show_main', { hash })
  else window.location.hash = hash
}
