// Where a tenant's files are on this machine: its world, files, modules, desks, agents and
// backups, under a tenant id on every path.
import { existsSync, mkdirSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { newId } from './db.ts'

export interface TenantPaths {
  dir: string
  world: string
  files: string
  modules: string
  desks: string
  agents: string
  instructions: string
  backups: string
  envs: string // per Mac, beside the tenants: Docling's environment
}

export function tenantPaths(dir: string): TenantPaths {
  return {
    dir,
    world: join(dir, 'world.sqlite'),
    files: join(dir, 'files'),
    modules: join(dir, 'modules'),
    desks: join(dir, 'desk'),
    agents: join(dir, 'agents'),
    instructions: join(dir, 'instructions'),
    backups: join(dir, 'backups'),
    envs: join(dir, '..', '..', 'envs'),
  }
}

// The tenant on this machine: single-tenant in features, a tenant id on every path.
export function tenantDir(home: string, id: string | null = null): string {
  const tenants = join(home, 'tenants')
  mkdirSync(tenants, { recursive: true })
  if (id) return join(tenants, id)
  const found = readdirSync(tenants, { withFileTypes: true }).find(
    (d) =>
      d.isDirectory() &&
      d.name.startsWith('t_') &&
      existsSync(join(tenants, d.name, 'world.sqlite')),
  )
  return join(tenants, found ? found.name : newId('t'))
}
