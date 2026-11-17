// Appearance: Match Mac (nothing set; the Mac's setting decides), Light or Dark, kept in this
// browser and put on <html> as data-theme, which app.css reads; and the text size.
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

// Text size: Small, Medium (the window's own sizes, nothing set) or Large, kept by Alpha per person
// and in this browser so it holds from the first paint; put on <html> as data-text.
export type TextSize = 'small' | 'medium' | 'large'

const SIZE = 'alpha-text-size'

export function savedTextSize(): TextSize {
  try {
    const t = localStorage.getItem(SIZE)
    return t === 'small' || t === 'large' ? t : 'medium'
  } catch {
    return 'medium'
  }
}

export function applyTextSize(t: TextSize): void {
  if (t === 'medium') delete document.documentElement.dataset.text
  else document.documentElement.dataset.text = t
  try {
    if (t === 'medium') localStorage.removeItem(SIZE)
    else localStorage.setItem(SIZE, t)
  } catch {
    // a private window: the choice lasts until the window closes
  }
}
