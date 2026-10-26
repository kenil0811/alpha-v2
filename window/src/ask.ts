// Start the assistant with words, unsent: the panel opens and the words wait in its composer for
// the person to finish and send. Kept here until a composer takes them, since a folded panel has
// none yet.
let waiting: string | null = null

export function startAsk(words: string) {
  waiting = words
  showAsk()
}

// Open the assistant's panel, on what was just said to it.
export function showAsk() {
  window.dispatchEvent(new Event('alpha:ask'))
}

export function takeAsk(): string | null {
  const w = waiting
  waiting = null
  return w
}
