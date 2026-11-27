// The one place the core asks what computer it is on.
import { LinuxPlatform } from './linux.ts'
import { MacPlatform } from './mac.ts'
import { PcPlatform } from './pc.ts'
import { PlainPlatform } from './plain.ts'
import type { Platform } from './platform.ts'

export { PlainPlatform } from './plain.ts'
export type { Platform } from './platform.ts'

export function platformHere(): Platform {
  if (process.platform === 'darwin') return new MacPlatform()
  // systemd hands a server's service its credentials, and a PC's (Alpha's Linux inside Windows)
  // the same; anything else on Linux is a test
  if (!process.env.CREDENTIALS_DIRECTORY) return new PlainPlatform()
  return process.env.ALPHA_ON_PC === '1' ? new PcPlatform() : new LinuxPlatform()
}
