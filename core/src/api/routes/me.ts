import { z } from 'zod'
import type { Ctx } from '../ctx.ts'
import type { FoundRow, Layout, Me } from '../types.ts'

export function registerMe(ctx: Ctx): void {
  const { app, world, user, options } = ctx

  const layoutOf = (): Layout => {
    const folded = world.preference(user.id, 'rail_folded_modules')
    const hidden = world.preference(user.id, 'rail_hidden_modules')
    const pinned = world.preference(user.id, 'rail_pinned_modules')
    const list = (key: string) => {
      const v = world.preference(user.id, key)
      return v ? (JSON.parse(v) as string[]) : []
    }
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
      recordHidden: list('record_hidden'),
      recordTabs: list('record_tabs'),
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
        recordHidden: z.array(z.string()).optional(),
        recordTabs: z.array(z.string()).optional(),
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
    for (const [key, v] of [
      ['record_hidden', given.recordHidden],
      ['record_tabs', given.recordTabs],
    ] as const)
      if (v !== undefined) world.setPreference(user.id, key, v.length ? JSON.stringify(v) : null)
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
