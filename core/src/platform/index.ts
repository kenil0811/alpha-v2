// The one place the core asks what computer it is on.
import { LinuxPlatform } from './linux.ts'
import { MacPlatform } from './mac.ts'
import { PlainPlatform } from './plain.ts'
import type { Platform } from './platform.ts'

export { PlainPlatform } from './plain.ts'
export type { Platform } from './platform.ts'

export function platformHere(): Platform {
  if (process.platform === 'darwin') return new MacPlatform()
  // systemd hands a server's service its credentials; anything else on Linux is a test
  return process.env.CREDENTIALS_DIRECTORY ? new LinuxPlatform() : new PlainPlatform()
}
