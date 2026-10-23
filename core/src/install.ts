// What the installer knows about this install (decision 12, step 4): one file, alpha.yaml in
// Alpha's data folder, written at first start and by install.sh, read at every start. The
// environment overrides it for a development run, never the other way round; ALPHA_HOME stays
// the one variable that says where the file is. The per-install token is its own file. Nothing
// here is a knob a person meets: Settings › This Mac shows the owner and the port, and changes
// keep_awake, which the core writes back.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { parse, stringify } from 'yaml'
import { z } from 'zod'

export const FILE = 'alpha.yaml'

export interface Install {
  owner: string | null // the person's name; none: the Mac's own name for its user, written back
  tenant: string | null // the world's tenant id; none: found or made at first start, written back
  port: number
  reportTo: string | null // the address a report is for: the maintainer's, or none
  helper: string | null // Alpha's helper app (the Keychain, Calendar, Contacts)
  uv: string | null // the uv the document reader's environment is made with
  logs: string | null // where core.log goes; none: the console only
  keepAwake: boolean // the Mac kept from sleeping while plugged in
  prepareReaders: boolean // the readers' downloads started at start
}

const Shape = z
  .object({
    owner: z.string().nullable(),
    tenant: z.string().nullable(),
    port: z.number().int().positive(),
    report_to: z.string().nullable(),
    helper: z.string().nullable(),
    uv: z.string().nullable(),
    logs: z.string().nullable(),
    keep_awake: z.boolean(),
    prepare_readers: z.boolean(),
  })
  .partial()

const DEFAULTS: Install = {
  owner: null,
  tenant: null,
  port: 4700,
  reportTo: null,
  helper: null,
  uv: null,
  logs: null,
  keepAwake: false,
  prepareReaders: false,
}

function fromFile(home: string): Partial<Install> {
  const file = join(home, FILE)
  if (!existsSync(file)) return {}
  const out = Shape.safeParse(parse(readFileSync(file, 'utf8')) ?? {})
  if (!out.success) throw new Error(`${file} is not right: ${z.prettifyError(out.error)}`)
  const f = out.data
  return {
    ...(f.owner !== undefined ? { owner: f.owner } : {}),
    ...(f.tenant !== undefined ? { tenant: f.tenant } : {}),
    ...(f.port !== undefined ? { port: f.port } : {}),
    ...(f.report_to !== undefined ? { reportTo: f.report_to } : {}),
    ...(f.helper !== undefined ? { helper: f.helper } : {}),
    ...(f.uv !== undefined ? { uv: f.uv } : {}),
    ...(f.logs !== undefined ? { logs: f.logs } : {}),
    ...(f.keep_awake !== undefined ? { keepAwake: f.keep_awake } : {}),
    ...(f.prepare_readers !== undefined ? { prepareReaders: f.prepare_readers } : {}),
  }
}

// The environment's say, for a development run: each ALPHA_* variable wins over the file.
function fromEnv(env: NodeJS.ProcessEnv): Partial<Install> {
  const s = (k: string) => (env[k]?.trim() ? (env[k] as string).trim() : undefined)
  const port = s('ALPHA_PORT') ? Number(s('ALPHA_PORT')) : undefined
  return {
    ...(s('ALPHA_OWNER') ? { owner: s('ALPHA_OWNER') as string } : {}),
    ...(port && Number.isInteger(port) && port > 0 ? { port } : {}),
    ...(s('ALPHA_REPORT_TO') ? { reportTo: s('ALPHA_REPORT_TO') as string } : {}),
    ...(s('ALPHA_HELPER_APP') ? { helper: s('ALPHA_HELPER_APP') as string } : {}),
    ...(s('ALPHA_UV') ? { uv: s('ALPHA_UV') as string } : {}),
    ...(s('ALPHA_LOG_DIR') ? { logs: s('ALPHA_LOG_DIR') as string } : {}),
    ...(env.ALPHA_KEEP_AWAKE !== undefined ? { keepAwake: env.ALPHA_KEEP_AWAKE === '1' } : {}),
    ...(env.ALPHA_PREPARE_READERS !== undefined
      ? { prepareReaders: env.ALPHA_PREPARE_READERS === '1' }
      : {}),
  }
}

export function readInstall(home: string, env: NodeJS.ProcessEnv = process.env): Install {
  return { ...DEFAULTS, ...fromFile(home), ...fromEnv(env) }
}

// What the core learned at start (the tenant, the owner's name) or the person changed (keep
// awake), written back: the file's other lines stay as they are.
export function writeInstall(home: string, patch: Partial<Install>): void {
  const file = join(home, FILE)
  const kept = existsSync(file) ? ((parse(readFileSync(file, 'utf8')) as object) ?? {}) : {}
  const next: Record<string, unknown> = { ...kept }
  const put = (key: string, value: unknown) => {
    if (value !== undefined) next[key] = value
  }
  put('owner', patch.owner)
  put('tenant', patch.tenant)
  put('port', patch.port)
  put('report_to', patch.reportTo)
  put('helper', patch.helper)
  put('uv', patch.uv)
  put('logs', patch.logs)
  put('keep_awake', patch.keepAwake)
  put('prepare_readers', patch.prepareReaders)
  mkdirSync(home, { recursive: true })
  writeFileSync(
    file,
    `# What the installer knows about this Alpha; the environment overrides it for a development run.\n${stringify(next)}`,
  )
}
