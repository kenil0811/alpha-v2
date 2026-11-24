// The bar's path: from Home to the page above the one on screen, each part a way there (H1). A
// task's thread sits under Tasks, a page of Settings under Settings, and a module's tables and rows
// under the modules it sits in, never naming the module itself.
import type { ModuleSummary, TableView as TableData } from '@alpha/core/api'
import type { Crumb } from './Bar.tsx'
import type { Place } from './place.ts'
import type { RowPlace } from './RowPage.tsx'
import { landingOf } from './tree.ts'

export interface Here {
  place: Place
  modules: ModuleSummary[]
  rowPlace: RowPlace | null
  table: TableData | null
  itemName: string
  moduleHereId: string | null
}

const HOME = { label: 'Home', href: '#/' }

// the page above this one; none on Home
function parentOf(h: Here): Crumb | null {
  const { place, rowPlace, table, itemName } = h
  switch (place.at) {
    case 'tasks':
      return place.id ? { label: 'Tasks', href: '#/tasks' } : HOME
    case 'work':
      return { label: itemName || 'The task', href: `#/tasks/${place.id}` }
    case 'row':
      return rowPlace && { label: rowPlace.table.name, href: `#/table/${rowPlace.table.id}` }
    // a module's own tables and pages are the module: the path names only the modules it sits in
    case 'table':
      return place.row ? table && { label: table.name, href: `#/table/${place.id}` } : HOME
    case 'module':
      // a module's details sit under its Setup
      return place.tab === 'details' ? { label: 'Setup', href: `#/module/${place.id}/setup` } : HOME
    case 'item':
      return place.kind === 'schedule'
        ? { label: 'Automations', href: '#/settings/schedules' }
        : place.kind === 'run'
          ? { label: 'Logs', href: '#/settings/logs' }
          : { label: 'Rules', href: '#/settings/rules' }
    // an agent's page is one of Agents'
    case 'agent':
      return { label: 'Agents', href: '#/conversation' }
    // a computer's page is one of Connections › Your computers
    case 'computer':
      return { label: 'Connections', href: '#/settings/connections' }
    // a kept file is one of Settings › Files
    case 'file':
      return { label: 'Files', href: '#/settings/files' }
    case 'people':
      if (!place.id) return HOME
      return place.kind === 'company'
        ? { label: 'Organizations', href: '#/people?companies' }
        : { label: 'People', href: '#/people' }
    // every other page goes Home; Home alone has nothing above it
    case 'home':
      return null
    default:
      return HOME
  }
}

// the modules a module sits in, outermost first, each opening where it opens
function outer(modules: ModuleSummary[], id: string | null | undefined): Crumb[] {
  const chain: Crumb[] = []
  let up = id ? modules.find((m) => m.id === id)?.parent : null
  while (up) {
    const p = modules.find((m) => m.id === up)
    if (!p || chain.length > 8) break
    chain.unshift({ label: p.name, href: landingOf(modules, p) })
    up = p.parent
  }
  return chain
}

// the path from Home to the page above this one, for the bar: a task's thread is under Tasks, a
// page of Settings under Settings, and a module's tables and rows under the modules it sits in,
// so ‹ goes to the module above, as it always has
export function trailOf(h: Here): Crumb[] {
  const { place, rowPlace, modules, moduleHereId } = h
  const up = parentOf(h)
  if (!up) return []
  if (place.at === 'work') return [HOME, { label: 'Tasks', href: '#/tasks' }, up]
  if (up.href.startsWith('#/settings/'))
    return [HOME, { label: 'Settings', href: '#/settings' }, up]
  const within =
    place.at === 'row'
      ? outer(modules, rowPlace?.module.id)
      : place.at === 'table' || place.at === 'module'
        ? outer(modules, moduleHereId)
        : []
  return up.href === '#/' ? [HOME, ...within] : [HOME, ...within, up]
}
