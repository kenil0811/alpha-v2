// The one place the core asks what computer it is on.
import { MacPlatform } from './mac.ts'
import { PlainPlatform } from './plain.ts'
import type { Platform } from './platform.ts'

export { PlainPlatform } from './plain.ts'
export type { Platform } from './platform.ts'

export function platformHere(): Platform {
  return process.platform === 'darwin' ? new MacPlatform() : new PlainPlatform()
}
