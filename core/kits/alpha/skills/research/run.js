// Research: a brief on alpha.input.ask, ranked by value, every line cited.
export default async (alpha) => {
  const { ask, about } = alpha.input
  if (!ask) return { words: 'Research needs an ask.' }
  return alpha.research({ ask, ...(about ? { about } : {}) })
}
