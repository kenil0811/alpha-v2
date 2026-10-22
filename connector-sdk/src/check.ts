// What is wrong with a connector before it is loaded: its manifest, each tool's effect and words,
// its tables' kinds, a name already taken. The same check runs on `pnpm connector check` and when
// a folder is added in Settings; a connector that fails it is left out, never fatal.
import { z } from 'zod'
import { type Connector, FIELD_KINDS, type Manifest } from './connector.ts'
import { EFFECTS } from './effects.ts'

export const NAME = /^[a-z][a-z0-9-]{0,39}$/
// The model's own servers, and the one every connector once shared.
export const RESERVED_NAMES = ['alpha', 'claude', 'ide', 'connectors'] as const

const ManifestSchema = z.object({
  name: z.string().regex(NAME, 'letters, digits and dashes, starting with a letter'),
  title: z.string().min(1),
  auth: z.enum(['secret', 'oauth', 'browser', 'system', 'path']),
  icon: z.enum(['mail', 'calendar', 'people', 'network', 'folder', 'plug']).optional(),
  account: z.object({ label: z.string().min(1), placeholder: z.string().optional() }),
  secret: z
    .object({ label: z.string().min(1), help: z.string(), url: z.string().optional() })
    .optional(),
  pace: z.object({ perMinute: z.number().positive(), perDay: z.number().positive().optional() }),
  syncEveryMinutes: z.number().positive().optional(),
  signIn: z.string().url().optional(),
  system: z.object({ pane: z.string().min(1) }).optional(),
  setup: z.object({ sub: z.string().min(1) }).optional(),
  warning: z.string().min(1).optional(),
})

const isObject = (x: unknown): x is Record<string, unknown> => typeof x === 'object' && x !== null

// Every problem with what a folder exported as its connector, in plain words; none means it is a
// connector Alpha can load.
export function checkConnector(x: unknown, taken: string[] = []): string[] {
  const out: string[] = []
  if (!isObject(x)) return ['It is not a connector object.']
  const m = ManifestSchema.safeParse(x.manifest)
  if (!m.success) {
    for (const issue of m.error.issues)
      out.push(`manifest.${issue.path.join('.') || '?'}: ${issue.message}`)
  } else {
    const manifest = m.data as Manifest
    if ((RESERVED_NAMES as readonly string[]).includes(manifest.name))
      out.push(`A connector cannot be called ${manifest.name}: the model's own servers use it.`)
    if (taken.includes(manifest.name))
      out.push(`A connector called ${manifest.name} is loaded already.`)
    if (manifest.auth === 'secret' && !manifest.secret)
      out.push('manifest.secret: a connector that signs in with a secret says what it is called.')
    if (manifest.auth === 'browser' && !manifest.signIn)
      out.push('manifest.signIn: a connector the person signs in to in a browser says where.')
    if (manifest.auth === 'system' && !manifest.system)
      out.push('manifest.system: a connector the Mac asks about names its System Settings pane.')
  }
  if (typeof x.guide !== 'string' || !x.guide.trim())
    out.push('guide: what the model reads about it is missing.')
  if (typeof x.module !== 'string' || !x.module.trim())
    out.push('module: where its tables live is missing.')
  if (!Array.isArray(x.tables)) out.push('tables: a list, even an empty one.')
  else
    x.tables.forEach((t, i) => {
      if (!isObject(t) || typeof t.name !== 'string' || !Array.isArray(t.fields)) {
        out.push(`tables[${i}]: a name and its fields.`)
        return
      }
      for (const f of t.fields as unknown[]) {
        if (!isObject(f) || typeof f.name !== 'string')
          out.push(`${t.name}: a field without a name.`)
        else if (!(FIELD_KINDS as readonly string[]).includes(String(f.kind)))
          out.push(
            `${t.name}.${f.name}: the kind ${String(f.kind)} is not one Alpha has (${FIELD_KINDS.join(', ')}).`,
          )
      }
    })
  if (!isObject(x.tools)) out.push('tools: a map, even an empty one.')
  else
    for (const [name, t] of Object.entries(x.tools)) {
      if (!NAME.test(name))
        out.push(`tools.${name}: letters, digits and dashes, starting with a letter.`)
      if (!isObject(t)) {
        out.push(`tools.${name}: not a tool.`)
        continue
      }
      if (typeof t.description !== 'string' || !t.description.trim())
        out.push(`tools.${name}: no description.`)
      if (!isObject(t.input)) out.push(`tools.${name}: no input shape.`)
      if (
        typeof t.effect !== 'function' &&
        !(EFFECTS as readonly string[]).includes(String(t.effect))
      )
        out.push(`tools.${name}: its effect is not one of ${EFFECTS.join(', ')}.`)
      if (typeof t.run !== 'function') out.push(`tools.${name}: nothing to run.`)
      if (t.words !== undefined && typeof t.words !== 'function')
        out.push(`tools.${name}: words is a function of the input.`)
      if (t.preview !== undefined && typeof t.preview !== 'function')
        out.push(`tools.${name}: preview is a function of the input.`)
    }
  for (const k of ['check', 'sync'] as const)
    if (x[k] !== undefined && typeof x[k] !== 'function')
      out.push(`${k}: a function, when there is one.`)
  if (x.files !== undefined) {
    const f = x.files
    if (
      !isObject(f) ||
      typeof f.table !== 'string' ||
      typeof f.field !== 'string' ||
      typeof f.fetch !== 'function'
    )
      out.push('files: a table, its field and a fetch.')
  }
  return out
}

export function isConnector(x: unknown, taken: string[] = []): x is Connector {
  return checkConnector(x, taken).length === 0
}
