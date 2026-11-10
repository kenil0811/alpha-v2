// The walls on the route's file tools: what a turn may read and write.
import { realpathSync } from 'node:fs'
import { resolve } from 'node:path'
import type { Decision } from './provider.ts'

function inside(path: string, base: string, roots: string[]): boolean {
  let full = resolve(base, path)
  try {
    full = realpathSync(full)
  } catch {
    try {
      full = resolve(realpathSync(resolve(full, '..')), full.split('/').pop() as string)
    } catch {
      // a path whose folder is not there either: judged as written
    }
  }
  return roots.some((r) => full === r || full.startsWith(`${r}/`))
}

// The walls on the route's file tools: reads in the desk's folder, the modules and the granted
// folders; writes in the first two only; and a module's module.yaml never by hand, since its sites
// and shape change through the shape tool and the person's cards.
export function fileWall(
  tool: string,
  input: Record<string, unknown>,
  deskDir: string,
  modules: string,
  granted: string[],
): Decision {
  const path = String(input.file_path ?? input.path ?? input.notebook_path ?? '')
  if (tool === 'Read') {
    if (inside(path, deskDir, [deskDir, modules, ...granted])) return { allow: true }
    return { allow: false, reason: `${path} is not in a folder the person granted.` }
  }
  if (tool === 'Write' || tool === 'Edit' || tool === 'NotebookEdit') {
    if (/(^|\/)module\.yaml$/.test(path) && inside(path, deskDir, [modules]))
      return {
        allow: false,
        reason:
          'module.yaml is written by Alpha from the shape tool and the person’s cards, never by hand.',
      }
    if (inside(path, deskDir, [deskDir, modules])) return { allow: true }
    return {
      allow: false,
      reason: `Alpha writes files only in ${deskDir} and the module folders under ${modules}.`,
    }
  }
  return { allow: false, reason: `${tool} is not one of Alpha's tools.` }
}
