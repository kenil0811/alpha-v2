import { z } from 'zod'
import { config } from '../../config.ts'
import type { Ctx } from '../ctx.ts'
import { askable, lookUp, placesKnown } from '../geocode.ts'
import type { DateRow, FoundRow, Layout, Me, PlaceRow } from '../types.ts'

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

  // Find (⌘K): rows by their words, each opening where it is; from a module's Overview, only its
  // own rows (Vikas, 3 Nov: a module's search is for what it keeps).
  app.get('/api/find', async (req): Promise<FoundRow[]> => {
    const { words, module } = z
      .object({ words: z.string().trim().min(1), module: z.string().optional() })
      .parse(req.query)
    const people: FoundRow[] = module
      ? []
      : [
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
        .search(words, module ? 60 : 12)
        .filter((h) => h.what === 'record')
        .flatMap((h) => {
          const rec = world.records.get(h.id)
          if (!rec || rec.table.hidden) return []
          if (module && rec.table.module.id !== module) return []
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

  // Every day worth seeing on the Calendar (Vikas, 3 Nov: "aggregation of all sessions, all
  // important days, all tasks"): open tasks with a due, and each row's date that looks ahead (a
  // field named Due, Starts, When, Expires, … ends, Next step…), never one that looks back (Added,
  // Last checked). The Calendar's own Events are its rows, not these.
  // ponytail: every row read on each call, as /api/places
  app.get('/api/dates', async (): Promise<DateRow[]> => {
    const ahead = /^(starts|when|date)$|due|expir|\bends$|deadline|next step|closing/i
    const tasks: DateRow[] = world.tasks.list({ open: true }).flatMap((t) =>
      t.due
        ? [
            {
              at: t.due,
              what: 'task' as const,
              label: t.title,
              hint: 'Task',
              module: null,
              href: `#/tasks/${t.id}`,
            },
          ]
        : [],
    )
    const rows = world.shape.tables().flatMap((t) => {
      if (t.hidden || (t.module.name === 'Calendar' && t.name === 'Events')) return []
      const fs = t.fields.filter((f) => f.kind === 'date' && ahead.test(f.name))
      if (!fs.length) return []
      return world.records.list(t.id).flatMap((r) =>
        fs.flatMap((f) => {
          const at = r.values[f.slug]
          if (typeof at !== 'string' || !at) return []
          return [
            {
              at,
              what: 'row' as const,
              label: world.rowName(t, r.values),
              hint: `${t.name}: ${f.name}`,
              module: t.module.name,
              href: `#/table/${t.id}/${r.id}`,
            },
          ]
        }),
      )
    })
    return [...tasks, ...rows]
  })

  // Every row that says where it is, for Network's map (Vikas, 3 Nov): a text field named for a
  // place, its value not a link or an address to write to.
  // ponytail: every row of every table read on each call; a places index if Network grows past it
  app.get('/api/places', async (): Promise<PlaceRow[]> => {
    const known = placesKnown(world.paths.dir)
    const rows = world.shape.tables().flatMap((t) => {
      if (t.hidden) return []
      const f = t.fields.find(
        (x) => x.kind === 'text' && /^(location|city|address|place|based in|office)$/i.test(x.name),
      )
      if (!f) return []
      return world.records.list(t.id).flatMap((r) => {
        const place = String(r.values[f.slug] ?? '').trim()
        if (!place || /^https?:|@/.test(place)) return []
        return [
          {
            place,
            label: world.rowName(t, r.values),
            hint: t.name,
            module: t.module.name,
            href: `#/table/${t.id}/${r.id}`,
            at: known[place] ?? null,
            finding: askable(place) && !(place in known),
          },
        ]
      })
    })
    lookUp(
      world.paths.dir,
      rows.filter((r) => r.finding).map((r) => r.place),
    )
    return rows
  })
}
