// The plugins' screens, found when the window is built: each plugin may hold a window/ of its own
// (plugins/<name>/window/index.tsx exporting `screen`). Removing a plugin's folder removes its
// page and its row on Home at the next build; with none, the window is as it was.
import type { Screen } from './kit.ts'

const found = import.meta.glob<{ screen?: Screen }>('../../../plugins/*/window/index.tsx', {
  eager: true,
})

export const SCREENS: Screen[] = Object.values(found).flatMap((m) => (m.screen ? [m.screen] : []))

export const screenOf = (name: string): Screen | null =>
  SCREENS.find((s) => s.name === name) ?? null
