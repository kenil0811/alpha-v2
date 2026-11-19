// The plugins' screens, found when the window is built: each plugin may hold a window/ of its own
// (plugins/<name>/window/index.tsx exporting `screen`). Removing a plugin's folder removes its
// page and its row on Home at the next build; with none, the window is as it was. A screen shows
// only while the core says its plugin is on here (alpha.yaml's plugins line, rules P1).
import type { Screen } from './kit.ts'

const found = import.meta.glob<{ screen?: Screen }>('../../../plugins/*/window/index.tsx', {
  eager: true,
})

export const SCREENS: Screen[] = Object.values(found).flatMap((m) => (m.screen ? [m.screen] : []))

// The plugins on here, as the core said when the window started (/api/me): none until it says.
let on = new Set<string>()
export const switchedOn = (names: string[]): void => {
  on = new Set(names)
}

// The screens of the plugins on here.
export const shownScreens = (): Screen[] => SCREENS.filter((s) => on.has(s.name))

export const screenOf = (name: string): Screen | null =>
  shownScreens().find((s) => s.name === name) ?? null
