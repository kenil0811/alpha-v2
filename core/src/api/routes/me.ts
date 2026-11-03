import { z } from 'zod'
import { config } from '../../config.ts'
import type { Ctx } from '../ctx.ts'
import type { FoundRow, Layout, Me } from '../types.ts'

export function registerMe(ctx: Ctx): void {
  const { app, world, user } = ctx

  const layoutOf = (): Layout => {
    const folded = world.preference(user.id, 'rail_folded_modules')
    const hidden = world.preference(user.id, 'rail_hidden_modules')
    const order = world.preference(user.id, 'rail_order')
    const panel = Number(world.preference(user.id, 'panel_width'))
    const n = (key: string) => {
      const v = Number(world.preference(user.id, key))
      return Number.isFinite(v) && v > 0 ? v : null
    }
    return {
      railFolded: world.preference(user.id, 'rail_folded') === 'yes',
      folded: folded ? (JSON.parse(folded) as string[]) : [],
      hidden: hidden ? (JSON.parse(hidden) as string[]) : [],
      order: order ? (JSON.parse(order) as string[]) : [],
      railWidth: n('rail_width'),
      panel: Number.isFinite(panel) && panel > 0 ? panel : null,
      assistant: world.preference(user.id, 'assistant_folded') === 'yes' ? 'folded' : 'open',
      pageSize: n('page_size'),
      pins: json('module_pins'),
      seen: json('seen_counts'),
      docked: (() => {
        const v = world.preference(user.id, 'rail_docked')
        return v ? (JSON.parse(v) as string[]) : null
      })(),
      // only once something was dragged: a page never arranged keeps its own order
      ...(world.preference(user.id, 'block_arrange')
        ? { arrange: json<string[][]>('block_arrange') }
        : {}),
    }
  }
  const json = <T>(key: string): Record<string, T> => {
    const v = world.preference(user.id, key)
    return v ? (JSON.parse(v) as Record<string, T>) : {}
  }

  app.get('/api/me', async (): Promise<Me> => {
    const theme = world.preference(user.id, 'theme')
    const size = world.preference(user.id, 'text_size')
    return {
      user: { id: user.id, name: user.name },
      tenant: world.tenant,
      theme: theme === 'light' || theme === 'dark' ? theme : 'mac',
      textSize: size === 'medium' || size === 'large' ? size : 'small',
      layout: layoutOf(),
      foldLines: config.limits().reply_fold_lines,
    }
  })

  // How the person left the window: the rail, its folds, the side conversation's width.
  app.post('/api/layout', async (req): Promise<Layout> => {
    const given = z
      .object({
        railFolded: z.boolean().optional(),
        folded: z.array(z.string()).optional(),
        hidden: z.array(z.string()).optional(),
        // the rail's modules as dragged between one another (Vikas, 2 Nov)
        order: z.array(z.string().max(120)).max(500).optional(),
        panel: z.number().int().positive().nullable().optional(),
        railWidth: z.number().int().positive().nullable().optional(),
        assistant: z.enum(['open', 'folded']).optional(),
        pageSize: z.number().int().positive().nullable().optional(),
        pins: z.record(z.string(), z.array(z.string())).optional(),
        docked: z.array(z.string().max(200)).max(12).nullable().optional(),
        // a page's arrangement, or null to give it back its own order
        arrange: z
          .record(
            z.string().max(120),
            z
              .array(z.array(z.string().max(120)).min(1).max(6))
              .max(80)
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
    if (given.order !== undefined)
      world.setPreference(
        user.id,
        'rail_order',
        given.order.length ? JSON.stringify(given.order) : null,
      )
    if (given.pins !== undefined)
      world.setPreference(
        user.id,
        'module_pins',
        JSON.stringify({ ...json('module_pins'), ...given.pins }),
      )
    if (given.arrange !== undefined) {
      const kept: Record<string, string[][]> = json('block_arrange')
      for (const [page, rows] of Object.entries(given.arrange))
        if (rows) kept[page] = rows
        else delete kept[page]
      world.setPreference(
        user.id,
        'block_arrange',
        Object.keys(kept).length ? JSON.stringify(kept) : null,
      )
    }
    if (given.docked !== undefined)
      world.setPreference(
        user.id,
        'rail_docked',
        given.docked === null ? null : JSON.stringify(given.docked),
      )
    if (given.panel !== undefined)
      world.setPreference(user.id, 'panel_width', given.panel === null ? null : String(given.panel))
    return layoutOf()
  })

  // A screen or card opened: counted per person, so a module's Overview puts what is used first.
  app.post('/api/seen', async (req): Promise<Layout> => {
    const { key } = z.object({ key: z.string().min(1).max(120) }).parse(req.body)
    const seen = json<number>('seen_counts')
    seen[key] = (seen[key] ?? 0) + 1
    world.setPreference(user.id, 'seen_counts', JSON.stringify(seen))
    return layoutOf()
  })

  app.post('/api/appearance', async (req) => {
    const { theme, textSize } = z
      .object({
        theme: z.enum(['mac', 'light', 'dark']).optional(),
        textSize: z.enum(['small', 'medium', 'large']).optional(),
      })
      .parse(req.body)
    if (theme) world.setPreference(user.id, 'theme', theme === 'mac' ? null : theme)
    if (textSize) world.setPreference(user.id, 'text_size', textSize === 'small' ? null : textSize)
    return { ok: true }
  })

  // Find (⌘K): rows by their words, each opening where it is.
  app.get('/api/find', async (req): Promise<FoundRow[]> => {
    const { words } = z.object({ words: z.string().trim().min(1) }).parse(req.query)
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
