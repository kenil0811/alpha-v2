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

// Text size: Small is the plain size; Medium and Large scale the text and spacing (app.css).
export type TextSize = 'small' | 'medium' | 'large'

export function applyTextSize(t: TextSize): void {
  if (t === 'small') delete document.documentElement.dataset.text
  else document.documentElement.dataset.text = t
}
