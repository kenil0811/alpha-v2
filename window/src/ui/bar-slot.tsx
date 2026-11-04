// What a screen puts in the middle of the bar: its pill switch, or its title (out of Shell.tsx, so a
// part can reach it). A screen that puts nothing there gets its name in serif.
import { createContext, type ReactNode, useContext } from 'react'
import { createPortal } from 'react-dom'

const Middle = createContext<HTMLElement | null>(null)
export const BarMiddle = Middle.Provider
export const useBarSlot = () => useContext(Middle)

export function InBar({ children }: { children: ReactNode }) {
  const at = useContext(Middle)
  return at ? createPortal(children, at) : null
}

// The bar's two sides, for a screen that holds more there than its name: Home's day and greeting
// on the left, what is next on the right (Vikas, 1 and 3 Nov).
type Side = { left: HTMLElement | null; right: HTMLElement | null }
const Sides = createContext<Side>({ left: null, right: null })
export const BarSides = Sides.Provider

export function InBarSide({ side, children }: { side: keyof Side; children: ReactNode }) {
  const at = useContext(Sides)[side]
  return at ? createPortal(children, at) : null
}
