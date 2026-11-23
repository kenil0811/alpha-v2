// A module's words shared by its pages: when something happened, and where the module came from.
// The core calls a module's package a kit; a person never reads that word.
export function when(at: string | null): string {
  if (!at) return 'not yet'
  return new Date(at).toLocaleString(undefined, {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}

// Where a module came from: Alpha's own, installed (with its version and maintainer), or made in a
// conversation.
export function originWords(
  from: {
    name: string
    version: string
    maintainer?: { name: string } | null
    core?: boolean
    changes?: number
  } | null,
): string {
  if (!from) return 'Made in a conversation'
  if (from.core) return `Alpha's own, version ${from.version}`
  const by = from.maintainer ? `, maintained by ${from.maintainer.name}` : ''
  const unseen = from.changes
    ? ` · ${from.changes} ${from.changes === 1 ? 'change of yours' : 'of your changes'} its maker hasn't seen`
    : ''
  return `From ${from.name}, version ${from.version}${by}${unseen}`
}
