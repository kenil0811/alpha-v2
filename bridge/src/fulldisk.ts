// Full Disk Access for Safari (Vikas, 23 Nov; proposed): on its person's yes in Alpha, the Bridge
// opens System Settings at Full Disk Access, and nothing else, then sees the grant by trying to read
// Safari's history, never by asking; once it reads, Safari is lent from here.
import { execFile } from 'node:child_process'

export const FULL_DISK = 'x-apple.systempreferences:com.apple.preference.security?Privacy_AllFiles'

export function openFullDisk(): void {
  if (process.platform === 'darwin') execFile('open', [FULL_DISK], () => undefined)
}

// Tries until it can read, or gives up after so many tries: true once it read.
export async function untilReadable(
  blocked: () => string | null,
  every = 5000,
  tries = 120, // ten minutes at five seconds
): Promise<boolean> {
  for (let i = 0; i < tries; i++) {
    if (!blocked()) return true
    await new Promise((ok) => setTimeout(ok, every))
  }
  return false
}
