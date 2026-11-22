import { z } from 'zod'
import { atNumber } from '../../world/shape/numbers.ts'
import { drawnTables, listOrders, setDrawn, setListOrder } from '../../world/table-prefs.ts'
import { VIEW_KINDS } from '../../world/views.ts'
import type { Ctx } from '../ctx.ts'
import type { FoundRow, Layout, Me, ViewOf } from '../types.ts'

export function registerMe(ctx: Ctx): void {
  const { app, world, user, options } = ctx

  const layoutOf = (): Layout => {
    const folded = world.preference(user.id, 'rail_folded_modules')
    const hidden = world.preference(user.id, 'rail_hidden_modules')
    const pinned = world.preference(user.id, 'rail_pinned_modules')
    const panel = Number(world.preference(user.id, 'panel_width'))
    const n = (key: string) => {
      const v = Number(world.preference(user.id, key))
      return Number.isFinite(v) && v > 0 ? v : null
    }
    return {
      railFolded: world.preference(user.id, 'rail_folded') === 'yes',
      folded: folded ? (JSON.parse(folded) as string[]) : [],
      hidden: hidden ? (JSON.parse(hidden) as string[]) : [],
      pinned: pinned ? (JSON.parse(pinned) as string[]) : [],
      railWidth: n('rail_width'),
      panel: Number.isFinite(panel) && panel > 0 ? panel : null,
      assistant: world.preference(user.id, 'assistant_folded') === 'yes' ? 'folded' : 'open',
      pageSize: n('page_size'),
      agent: world.preference(user.id, 'agent_chosen'),
      listOrder: listOrders(world.db, user.id),
      viewOf: drawnTables(world.db, user.id) as Record<string, ViewOf>,
    }
  }

  app.get('/api/me', async (): Promise<Me> => {
    const theme = world.preference(user.id, 'theme')
    const size = world.preference(user.id, 'text_size')
    return {
      user: { id: user.id, name: user.name, role: user.role },
      signIn: !!options.signIn,
      developer: options.data?.install().developer ?? false,
      tenant: world.tenant,
      theme: theme === 'light' || theme === 'dark' ? theme : 'mac',
      textSize: size === 'small' || size === 'large' ? size : 'medium',
      layout: layoutOf(),
      plugins: options.pluginsOn ?? [],
    }
  })

  // How the person left the window: the rail, its folds, the side conversation's width.
  app.post('/api/layout', async (req): Promise<Layout> => {
    const given = z
      .object({
        railFolded: z.boolean().optional(),
        folded: z.array(z.string()).optional(),
        hidden: z.array(z.string()).optional(),
        pinned: z.array(z.string()).optional(),
        panel: z.number().int().positive().nullable().optional(),
        railWidth: z.number().int().positive().nullable().optional(),
        assistant: z.enum(['open', 'folded']).optional(),
        pageSize: z.number().int().positive().nullable().optional(),
        agent: z.string().nullable().optional(),
        // each table named is kept on its own (none forgets it); tables not named stay as they are
        listOrder: z.record(z.string(), z.array(z.string()).nullable()).optional(),
        viewOf: z
          .record(
            z.string(),
            z
              .object({
                kind: z.enum(VIEW_KINDS),
                by: z.string().nullable(),
                until: z.string().nullable(),
                group: z.string().nullable(),
                measure: z.string().nullable(),
              })
              .nullable(),
          )
          .optional(),
      })
      .parse(req.body)
    const num = (v: number | null | undefined) => (v === null ? null : String(v))
    if (given.railWidth !== undefined)
      world.setPreference(user.id, 'rail_width', num(given.railWidth))
    if (given.pageSize !== undefined) world.setPreference(user.id, 'page_size', num(given.pageSize))
    if (given.assistant !== undefined)
      world.setPreference(user.id, 'assistant_folded', given.assistant === 'folded' ? 'yes' : null)
    if (given.agent !== undefined) world.setPreference(user.id, 'agent_chosen', given.agent)
    if (given.railFolded !== undefined)
      world.setPreference(user.id, 'rail_folded', given.railFolded ? 'yes' : null)
    if (given.folded !== undefined)
      world.setPreference(
        user.id,
        'rail_folded_modules',
        given.folded.length ? JSON.stringify(given.folded) : null,
      )
    if (given.hidden !== undefined)
      world.setPreference(
        user.id,
        'rail_hidden_modules',
        given.hidden.length ? JSON.stringify(given.hidden) : null,
      )
    if (given.pinned !== undefined)
      world.setPreference(
        user.id,
        'rail_pinned_modules',
        given.pinned.length ? JSON.stringify(given.pinned) : null,
      )
    for (const [table, ids] of Object.entries(given.listOrder ?? {}))
      setListOrder(world.db, user.id, table, ids)
    for (const [table, drawn] of Object.entries(given.viewOf ?? {}))
      setDrawn(world.db, user.id, table, drawn)
    if (given.panel !== undefined)
      world.setPreference(user.id, 'panel_width', given.panel === null ? null : String(given.panel))
    return layoutOf()
  })

  // The person's look and text size, kept with them so they follow them to another window.
  app.post('/api/appearance', async (req) => {
    const { theme, textSize } = z
      .object({
        theme: z.enum(['mac', 'light', 'dark']).optional(),
        textSize: z.enum(['small', 'medium', 'large']).optional(),
      })
      .parse(req.body)
    if (theme) world.setPreference(user.id, 'theme', theme === 'mac' ? null : theme)
    if (textSize) world.setPreference(user.id, 'text_size', textSize === 'medium' ? null : textSize)
    return { ok: true }
  })

  // what a number (1.3.4) names, first in Find: a module, a table or a row
  const numbered = (words: string): FoundRow[] => {
    const at = /^\d+(\.\d+)*$/.test(words) ? atNumber(world.db, words) : null
    if (at?.kind === 'module') {
      const m = world.shape.module(at.id)
      return m ? [{ label: m.name, hint: `Module ${words}`, href: `#/module/${m.id}` }] : []
    }
    if (at?.kind === 'table') {
      const t = world.shape.table(at.id)
      return t ? [{ label: t.name, hint: `Table ${words}`, href: `#/table/${t.id}` }] : []
    }
    const rec = at ? world.records.get(at.id) : undefined
    if (!rec) return []
    const label = world.rowName(rec.table, rec.record.values) || 'A row'
    return [
      { label, hint: `${rec.table.name} ${words}`, href: `#/table/${rec.table.id}/${at?.id}` },
    ]
  }

  // Find (⌘K): rows by their words, each opening where it is; a number, what it names.
  app.get('/api/find', async (req): Promise<FoundRow[]> => {
    const { words } = z.object({ words: z.string().trim().min(1) }).parse(req.query)
    const found = numbered(words)
    if (found.length) return found
    const people: FoundRow[] = [
      ...world.people.list('person', words).slice(0, 5),
      ...world.people.list('company', words).slice(0, 3),
    ].map((p) => ({
      label: p.name,
      hint: p.kind === 'company' ? 'Company' : (p.companies[0] ?? p.emails[0] ?? 'Person'),
      href: `#/people/${p.id}`,
    }))
    return [
      ...people,
      ...world
        .search(words, 12)
        .filter((h) => h.what === 'record')
        .flatMap((h) => {
          const rec = world.records.get(h.id)
          if (!rec || rec.table.hidden) return []
          return [
            {
              label: world.rowName(rec.table, rec.record.values),
              hint: rec.table.name,
              href: `#/table/${rec.table.id}/${h.id}`,
            },
          ]
        })
        .slice(0, 8),
    ]
  })
}
