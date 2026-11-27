// A person's own PC: Alpha's Linux inside Windows (WSL2), the same Linux Alpha as a server's,
// with the person at the screen. Its secrets are a server's sealed file, whose key Windows keeps
// for this person and hands in at each start. Their name, a notification and keeping the PC awake
// are the Windows app's: it reads the window's stream and holds the PC awake while plugged in.
// Claude's own sign-in runs here, and its page opens in the person's browser from the window,
// since nothing inside Linux can open a Windows browser.
import { LinuxPlatform } from './linux.ts'
import type { Platform } from './platform.ts'

export class PcPlatform extends LinuxPlatform implements Platform {
  override readonly name = 'pc' as const
}
