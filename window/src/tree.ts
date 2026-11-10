// Modules inside modules: the tree the rail, Home, the bar and the lens read from the
// flat list the core gives, each module naming the one it sits inside.
import type { ModuleSummary } from '@alpha/core/api'

type Placed = Pick<ModuleSummary, 'id' | 'name' | 'parent'>

// The modules at the top: those inside none, or inside one the window does not show.
export function tops<M extends Placed>(modules: M[]): M[] {
  return modules.filter((m) => !m.parent || !modules.some((p) => p.id === m.parent))
}

export function childrenOf<M extends Placed>(modules: M[], id: string): M[] {
  return modules.filter((m) => m.parent === id)
}

// A module and every module inside it, at any depth.
export function inside(modules: Placed[], id: string): string[] {
  const out = [id]
  for (let i = 0; i < out.length; i++)
    for (const m of modules) if (m.parent === out[i] && !out.includes(m.id)) out.push(m.id)
  return out
}

// The modules a module sits inside, outermost first.
export function ancestors<M extends Placed>(modules: M[], id: string): M[] {
  const out: M[] = []
  let at = modules.find((m) => m.id === id)?.parent
  while (at && !out.some((m) => m.id === at)) {
    const p = modules.find((m) => m.id === at)
    if (!p) break
    out.unshift(p)
    at = p.parent
  }
  return out
}

// The tree in reading order, each module with how deep it sits.
export function flat<M extends Placed>(modules: M[]): { module: M; depth: number }[] {
  const out: { module: M; depth: number }[] = []
  const walk = (m: M, depth: number) => {
    out.push({ module: m, depth })
    for (const c of childrenOf(modules, m.id)) walk(c, depth + 1)
  }
  for (const m of tops(modules)) walk(m, 0)
  return out
}

// Where a module opens, as its own screen would send it: the Overview of the modules inside it, its
// front page, People, its first table, else Setup. The rail links there straight, so opening a module
// is one load, not a stop on the way (Kenil, 10 Nov).
export function landingOf(
  modules: { id: string; parent: string | null }[],
  m: {
    id: string
    people: boolean
    pages: { name: string; front: boolean }[]
    tables: { id: string; place: string }[]
  },
): string {
  if (modules.some((x) => x.parent === m.id)) return `#/module/${m.id}/overview`
  const front = m.pages.find((p) => p.front)
  if (front) return `#/module/${m.id}/page/${front.name}`
  const first = m.tables.find((t) => t.place === 'main')
  if (first) return m.people ? '#/people' : `#/table/${first.id}`
  return `#/module/${m.id}/setup`
}
