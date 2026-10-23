import { z } from 'zod'
import type { Ctx } from '../ctx.ts'
import type { FoundRow, Layout, Me } from '../types.ts'

export function registerMe(ctx: Ctx): void {
  const { app, world, user } = ctx

  const layoutOf = (): Layout => {
    const folded = world.preference(user.id, 'rail_folded_modules')
    const panel = Number(world.preference(user.id, 'panel_width'))
    return {
      railFolded: world.preference(user.id, 'rail_folded') === 'yes',
      folded: folded ? (JSON.parse(folded) as string[]) : [],
      panel: Number.isFinite(panel) && panel > 0 ? panel : null,
    }
  }

  app.get('/api/me', async (): Promise<Me> => {
    const theme = world.preference(user.id, 'theme')
    return {
      user: { id: user.id, name: user.name },
      tenant: world.tenant,
      theme: theme === 'light' || theme === 'dark' ? theme : 'mac',
      layout: layoutOf(),
    }
  })

  // How the person left the window: the rail, its folds, the side conversation's width.
  app.post('/api/layout', async (req): Promise<Layout> => {
    const given = z
      .object({
        railFolded: z.boolean().optional(),
        folded: z.array(z.string()).optional(),
        panel: z.number().int().positive().nullable().optional(),
      })
      .parse(req.body)
    if (given.railFolded !== undefined)
      world.setPreference(user.id, 'rail_folded', given.railFolded ? 'yes' : null)
    if (given.folded !== undefined)
      world.setPreference(
        user.id,
        'rail_folded_modules',
        given.folded.length ? JSON.stringify(given.folded) : null,
      )
    if (given.panel !== undefined)
      world.setPreference(user.id, 'panel_width', given.panel === null ? null : String(given.panel))
    return layoutOf()
  })

  app.post('/api/appearance', async (req) => {
    const { theme } = z.object({ theme: z.enum(['mac', 'light', 'dark']) }).parse(req.body)
    world.setPreference(user.id, 'theme', theme === 'mac' ? null : theme)
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
