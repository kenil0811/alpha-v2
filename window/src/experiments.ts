// Features still being tried: each listed here, off until switched on in Settings › Experimental.
// The switch is kept in this browser only, so trying one never changes the business's world.
// A screen asks useExperiment('name') before it shows the feature.
import { useEffect, useState } from 'react'

export const EXPERIMENTS: { name: string; title: string; about: string }[] = []

const key = (name: string) => `alpha-experiment-${name}`
const CHANGED = 'alpha-experiment'

function isOn(name: string): boolean {
  try {
    return localStorage.getItem(key(name)) === 'on'
  } catch {
    return false // storage blocked: every experiment stays off
  }
}

export function setExperiment(name: string, on: boolean): void {
  try {
    if (on) localStorage.setItem(key(name), 'on')
    else localStorage.removeItem(key(name))
  } catch {
    // storage blocked: the switch can't be kept
  }
  window.dispatchEvent(new Event(CHANGED))
}

export function useExperiment(name: string): boolean {
  const [on, setOn] = useState(() => isOn(name))
  useEffect(() => {
    const look = () => setOn(isOn(name))
    window.addEventListener(CHANGED, look)
    window.addEventListener('storage', look)
    return () => {
      window.removeEventListener(CHANGED, look)
      window.removeEventListener('storage', look)
    }
  }, [name])
  return on
}
