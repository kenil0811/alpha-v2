// Appearance: Match Mac (nothing set; the Mac's setting decides), Light or Dark, kept in this
// browser and put on <html> as data-theme, which app.css reads.
export type Theme = 'mac' | 'light' | 'dark'

const KEY = 'alpha-theme'

export function savedTheme(): Theme {
  try {
    const t = localStorage.getItem(KEY)
    return t === 'light' || t === 'dark' ? t : 'mac'
  } catch {
    return 'mac'
  }
}

export function applyTheme(t: Theme): void {
  if (t === 'mac') delete document.documentElement.dataset.theme
  else document.documentElement.dataset.theme = t
  try {
    if (t === 'mac') localStorage.removeItem(KEY)
    else localStorage.setItem(KEY, t)
  } catch {
    // a private window: the choice lasts until the window closes
  }
}
