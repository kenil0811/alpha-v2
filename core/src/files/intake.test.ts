// Files that come by mail, on made-up mail and a stand-in for the model: never a real account.
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { ItemFile } from '@alpha/connector-sdk'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { World } from '../world/world.ts'
import { FILING, type Filing, Intake } from './intake.ts'
import type { Ask } from './reading.ts'

let home: string
let world: World
const alpha = { actor: { kind: 'alpha' as const } }
const csv = (s: string) => new TextEncoder().encode(s)

beforeEach(async () => {
  home = mkdtempSync(join(tmpdir(), 'alpha-intake-'))
  world = await World.open(join(home, 'tenants', 't_test'))
})

afterEach(() => {
  world.close()
  rmSync(home, { recursive: true, force: true })
})

function setUp(files: Record<string, ItemFile[]>, answer: (prompt: string) => unknown) {
  const owner = world.owner('Kenil')
  const desk = world.shape.makeModule('Desk', alpha)
  const deals = world.shape.makeTable(desk.id, 'Deals', [{ name: 'Name', kind: 'text' }], alpha)
  world.shape.setDocuments(deals.id, ['CIM', 'Teaser'], alpha)
  const [harbor] = world.records.add(
    deals.id,
    [{ values: { Name: 'Harbor Books' }, provenance: { kind: 'assumed', basis: 'a test' } }],
    alpha,
  )
  const mailbox = world.shape.makeModule('Mail', alpha)
  const mail = world.shape.makeTable(
    mailbox.id,
    'Mail',
    [
      { name: 'From', kind: 'text' },
      { name: 'Subject', kind: 'text' },
      { name: 'Date', kind: 'date' },
      { name: 'Attachments', kind: 'text' },
    ],
    alpha,
  )
  const prompts: string[] = []
  const ask: Ask = async (prompt) => {
    prompts.push(prompt)
    return { answer: answer(prompt), tokens: 900 }
  }
  const intake = new Intake(
    world,
    {
      sources: () => [{ connection: 'k1', title: 'Gmail', table: 'Mail', field: 'Attachments' }],
      fetch: async (_c, item) => files[item] ?? [],
    },
    ask,
    owner,
  )
  const arrives = (key: string, subject: string, attachments: string) =>
    world.records.land(
      mail.id,
      [
        {
          key,
          values: {
            From: 'Priya <priya@harbor.example>',
            Subject: subject,
            Date: new Date().toISOString(),
            Attachments: attachments,
          },
        },
      ],
      { connector: 'gmail', account: 'me' },
      { actor: { kind: 'connector', id: 'gmail' } },
    )
  return { owner, deals, harbor: harbor as string, intake, arrives, prompts }
}

const cim: ItemFile = {
  name: 'Harbor CIM.csv',
  mime: 'text/csv',
  bytes: csv('practice,revenue\nHarbor Books,1200000\n'),
  inline: false,
}
const logo: ItemFile = { name: 'logo.png', mime: 'image/png', bytes: csv('png'), inline: true }

describe('files that come by mail', () => {
  it('starts with the mail that comes after it is on, and proposes a place per file on a card', async () => {
    const s = setUp({ m1: [cim, logo], m0: [cim] }, () => ({
      files: [
        {
          file: 0,
          about: 'The CIM for Harbor Books.',
          table: 'Deals',
          row: 'HARBOR',
          kind: 'CIM',
          sure: 'sure',
          why: 'The subject and the file name it.',
        },
      ],
    }))
    s.arrives('m0', 'Before Alpha looked', 'Harbor CIM.csv')
    expect(await s.intake.due()).toBe(0) // the start is marked; older mail is left alone
    s.arrives('m1', 'Harbor Books CIM', 'Harbor CIM.csv, logo.png')
    expect(await s.intake.due()).toBe(1) // a card, though the model named a row that is not one
    const [card] = world.cards.waiting()
    expect(card?.words).toBe('Where does Harbor CIM.csv go?')
    expect(s.prompts[0]).toContain(`- ${s.harbor} (Name: Harbor Books)`)
    expect(s.prompts[0]).not.toContain('logo.png')
    expect(((card?.call?.input ?? {}) as Filing).row).toBeNull()
  })

  it('files it on the row the person settles on and reads it there; the same file again asks nothing', async () => {
    const s = setUp({ m1: [cim], m2: [cim] }, (prompt) => ({
      files: [
        {
          file: 0,
          about: 'The CIM for Harbor Books.',
          table: 'Deals',
          row: /- (r_\w+) \(Name: Harbor Books\)/.exec(prompt)?.[1] ?? null,
          kind: 'CIM',
          sure: 'sure',
          why: 'The subject names it.',
        },
      ],
    }))
    await s.intake.due()
    s.arrives('m1', 'Harbor Books CIM', 'Harbor CIM.csv')
    expect(await s.intake.due()).toBe(1)
    const [card] = world.cards.waiting()
    expect(card?.words).toBe('File Harbor CIM.csv on Harbor Books?')
    expect(card?.call?.tool).toBe(FILING)
    const view = s.intake.view(card as never)
    expect(view?.places).toEqual([
      {
        table: s.deals.id,
        name: 'Deals',
        kinds: ['CIM', 'Teaser'],
        rows: [{ id: s.harbor, name: 'Harbor Books' }],
      },
    ])
    expect(world.lines({ kinds: ['filed'] }).some((l) => l.data.document)).toBe(false) // not read before the yes
    s.intake.file(card?.id as string, { row: s.harbor, kind: 'CIM' }, s.owner)
    expect(world.cards.get(card?.id as string)?.state).toBe('yes')
    const [on] = world.rowFiles(s.harbor)
    expect([on?.file.name, on?.kind, on?.placedBy, !!on?.document]).toEqual([
      'Harbor CIM.csv',
      'CIM',
      `person:${s.owner.id}`,
      true,
    ])
    s.arrives('m2', 'Fwd: Harbor Books CIM', 'Harbor CIM.csv')
    expect(await s.intake.due()).toBe(0)
    expect(world.lines({ kinds: ['intake'] }).at(-1)?.words).toBe(
      '“Fwd: Harbor Books CIM” came with files already filed: Harbor CIM.csv is already on Harbor Books.',
    )
  })

  it('keeps a file with no row yet in Alpha and reads it, on no row', async () => {
    const s = setUp({ m1: [cim] }, () => ({ files: [] }))
    await s.intake.due()
    s.arrives('m1', 'A new client', 'Harbor CIM.csv')
    await s.intake.due()
    const [card] = world.cards.waiting()
    s.intake.file(card?.id as string, { row: null, kind: null }, s.owner)
    const hash = ((card?.call?.input ?? {}) as Filing).file
    expect(world.files.document(hash)?.kind).toBe('sheet')
    expect(world.rowsOfFile(hash)).toEqual([])
  })

  it('offers Always after three filed as proposed, then files that sender’s kind on that row without a card', async () => {
    const files: Record<string, ItemFile[]> = {}
    for (const n of [1, 2, 3, 4, 5])
      files[`m${n}`] = [
        { ...cim, name: `CIM ${n}.csv`, bytes: csv(`practice,month\nHarbor Books,${n}\n`) },
      ]
    const s = setUp(files, (prompt) => ({
      files: [
        {
          file: 0,
          about: 'An update for Harbor Books.',
          table: 'Deals',
          row: /- (r_\w+) \(Name: Harbor Books\)/.exec(prompt)?.[1] ?? null,
          kind: 'CIM',
          sure: 'sure',
          why: 'It names Harbor Books.',
        },
      ],
    }))
    await s.intake.due()
    for (const n of [1, 2, 3, 4]) {
      s.arrives(`m${n}`, `Harbor Books ${n}`, `CIM ${n}.csv`)
      await s.intake.due()
      const [card] = world.cards.waiting()
      const view = s.intake.view(card as never)
      if (n < 4) {
        expect(view?.always).toBeNull()
        s.intake.file(card?.id as string, { row: s.harbor, kind: 'CIM' }, s.owner)
      } else {
        expect(view?.always).toBe(
          'Always file what @harbor.example sends as a CIM on Harbor Books, without asking',
        )
        s.intake.file(card?.id as string, { row: s.harbor, kind: 'CIM', always: true }, s.owner)
      }
    }
    s.arrives('m5', 'Harbor Books 5', 'CIM 5.csv')
    expect(await s.intake.due()).toBe(0)
    expect(world.cards.waiting()).toEqual([])
    expect(world.rowFiles(s.harbor).map((f) => f.file.name)).toContain('CIM 5.csv')
    expect(world.lines({ kinds: ['told'] }).at(-1)?.words).toBe(
      'Filed CIM 5.csv from Priya <priya@harbor.example> on Harbor Books (your standing permission).',
    )
  })

  it('lets a declined file go, with the reason kept', async () => {
    const teaser: ItemFile = { ...cim, name: 'teaser.csv', bytes: csv('a,b\n1,2\n') }
    const s = setUp({ m1: [teaser] }, () => ({ files: [] }))
    await s.intake.due()
    s.arrives('m1', 'Some teaser', 'teaser.csv')
    await s.intake.due()
    const [card] = world.cards.waiting()
    const hash = ((card?.call?.input ?? {}) as Filing).file
    expect(world.files.file(hash)?.name).toBe('teaser.csv')
    s.intake.decline(card?.id as string, 'Not ours', s.owner)
    expect(world.cards.get(card?.id as string)?.state).toBe('no')
    expect(world.files.file(hash)).toBeUndefined()
    expect(world.lines({ kinds: ['intake'] }).at(-1)?.words).toBe('Declined teaser.csv: Not ours.')
  })
})
