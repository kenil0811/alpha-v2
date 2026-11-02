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
