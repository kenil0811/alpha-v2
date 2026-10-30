// Step 2, part 2 (Kenil's yes, 30 Oct): what a turn did outside Alpha. A counter-action is
// offered, and run by whoever reverts; a final one is named as done for good.
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { expect, it } from 'vitest'
import { World } from '../world.ts'
import { revert, undoable } from './revert.ts'

it('offers a counter-action and names a final action, on a turn with no rows', async () => {
  const home = mkdtempSync(join(tmpdir(), 'alpha-revert-actions-'))
  const world = await World.open(join(home, 'tenants', 't_test'))
  const user = world.owner('Kenil')
  const said = world.line({
    actor: { kind: 'person', id: user.id },
    kind: 'said',
    words: 'draft and send',
    user: user.id,
  })
  const turn = String(said.id)
  const line = (kind: string, words: string, data: Record<string, unknown>) =>
    world.line({ actor: { kind: 'alpha' }, kind, words, data, user: user.id, turn })
  line('call', 'Saved a draft to priya@harbor.example', {
    tool: 'mcp__gmail__draft',
    input: { to: 'priya@harbor.example' },
    call: 'c1',
  })
  line('called', 'Done.', {
    call: 'c1',
    ok: true,
    undo: {
      kind: 'counter',
      did: 'Saved a draft to priya@harbor.example',
      words: 'Deletes the draft to priya@harbor.example',
      result: { draft: '<d1>' },
    },
  })
  line('call', 'Send an email to priya@harbor.example', {
    tool: 'mcp__gmail__send',
    input: { to: 'priya@harbor.example' },
    call: 'c2',
  })
  line('called', 'Done.', {
    call: 'c2',
    ok: true,
    undo: {
      kind: 'final',
      did: 'Send an email to priya@harbor.example',
      words: null,
      result: { sent: true },
    },
  })
  expect(undoable(world.records, { turn })).toBe(true)
  const person = { actor: { kind: 'person' as const, id: user.id }, user: user.id }
  const preview = revert(world.records, { turn }, person, 'what Alpha did', { preview: true })
  expect(preview.can).toBe(true)
  expect(preview.words).toBe('Deletes the draft to priya@harbor.example.')
  expect(preview.left).toEqual([
    '“Send an email to priya@harbor.example” was done outside Alpha and cannot be called back.',
  ])
  expect(preview.takeBacks.map((t) => t.words)).toEqual([
    'Deletes the draft to priya@harbor.example',
  ])
  const done = revert(world.records, { turn }, person, 'what Alpha did')
  expect(done.takeBacks).toHaveLength(1)
  world.close()
  rmSync(home, { recursive: true, force: true })
})
