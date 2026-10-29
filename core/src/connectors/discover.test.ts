import {
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { MemorySecrets, FIELD_KINDS as SDK_KINDS } from '@alpha/connector-sdk'
import { FIELD_KINDS as KIT_KINDS } from '@alpha/kit-sdk'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { World } from '../world/world.ts'
import {
  addFolder,
  available,
  checkFolder,
  loadConnector,
  loadSet,
  pack,
  removeFolder,
  STANDARD_DIR,
  unpack,
  updateOwn,
} from './discover.ts'
import { ConnectorService } from './service.ts'

const EXTRA = join(STANDARD_DIR, '..', 'connectors-extra')
let dir: string
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'alpha-discover-'))
})
afterEach(() => rmSync(dir, { recursive: true, force: true }))

describe('connectors found in their folders', () => {
  it('keeps the kit API’s field kinds and the connector SDK’s the same list', () => {
    expect([...SDK_KINDS]).toEqual([...KIT_KINDS])
  })

  it('loads the standard set from the repository, without LinkedIn', async () => {
    const { connectors, failed } = await loadSet(STANDARD_DIR)
    expect(failed).toEqual([])
    expect(connectors.map((c) => c.manifest.name)).toEqual([
      'folder',
      'gmail',
      'calendar',
      'contacts',
    ])
  })

  it('says which folder did not load and why, and goes on', async () => {
    mkdirSync(join(dir, 'broken'))
    writeFileSync(join(dir, 'broken', 'package.json'), '{"name":"broken","main":"index.js"}')
    writeFileSync(
      join(dir, 'broken', 'index.js'),
      'export const connector = { manifest: { name: "broken" } }',
    )
    mkdirSync(join(dir, 'nothing'))
    writeFileSync(join(dir, 'nothing', 'package.json'), '{"name":"nothing","main":"index.js"}')
    writeFileSync(join(dir, 'nothing', 'index.js'), 'export const other = 1')
    mkdirSync(join(dir, 'notes')) // no package.json: not a connector folder, skipped
    const { connectors, failed } = await loadSet(dir)
    expect(connectors).toEqual([])
    expect(failed.map((f) => [f.folder.split('/').at(-1), f.why])).toEqual([
      ['broken', expect.stringMatching(/manifest\.title/)],
      ['nothing', 'its entry exports no connector (export const connector)'],
    ])
    expect(await checkFolder(join(dir, 'broken'))).toContainEqual(
      expect.stringMatching(/manifest\.auth/),
    )
  })

  it('refuses a name already loaded, or one the model’s own servers use', async () => {
    const { connectors } = await loadSet(STANDARD_DIR)
    await expect(loadConnector(join(STANDARD_DIR, 'gmail'), ['gmail'])).rejects.toThrow(
      /gmail is loaded already/,
    )
    const world = await World.open(join(dir, 'tenant'))
    const svc = new ConnectorService(world, { secrets: new MemorySecrets(), known: connectors })
    const gmail = connectors.find((c) => c.manifest.name === 'gmail')
    expect(() =>
      svc.add({ ...gmail, manifest: { ...gmail?.manifest, name: 'alpha' } } as never),
    ).toThrow(/cannot be called alpha/)
    expect(() => svc.drop('nothing')).toThrow(/no connector called nothing/)
    world.close()
  })

  it('packs LinkedIn, unpacks it beside the kits with the SDK linked, and loads it', async () => {
    const file = await pack(join(EXTRA, 'linkedin'), dir)
    expect(file.endsWith('/linkedin-1.1.0.alphaconnector')).toBe(true)
    const home = join(dir, 'connectors')
    const { name, dir: unpacked } = unpack(file, home)
    expect(name).toBe('linkedin')
    expect(unpacked).toBe(join(home, 'linkedin'))
    // one SDK and one zod: linked to the core's own copies, never a second copy inside
    expect(
      lstatSync(join(unpacked, 'node_modules', '@alpha', 'connector-sdk')).isSymbolicLink(),
    ).toBe(true)
    expect(lstatSync(join(unpacked, 'node_modules', 'zod')).isSymbolicLink()).toBe(true)
    const [linkedin] = await loadConnector(unpacked)
    expect(linkedin?.manifest.name).toBe('linkedin')
    expect(linkedin?.manifest.warning).toMatch(/asks that its pages not be read automatically/)
    const { connectors } = await loadSet(home)
    expect(connectors.map((c) => c.manifest.name)).toEqual(['linkedin'])
    // the packs that came with the release, offered until added
    mkdirSync(join(home, 'available'))
    writeFileSync(
      join(home, 'available', 'linkedin-1.1.0.alphaconnector'),
      await import('node:fs').then((fs) => fs.readFileSync(file)),
    )
    expect(available(home).map((p) => [p.name, p.title, p.version])).toEqual([
      ['linkedin', 'LinkedIn', '1.1.0'],
    ])
    removeFolder(home, 'linkedin')
    expect(existsSync(unpacked)).toBe(false)
  })

  it('updates an added connector that came with Alpha to the newest pack the release brought (29 Oct)', async () => {
    const home = join(dir, 'connectors')
    const avail = join(home, 'available')
    mkdirSync(avail, { recursive: true })
    const now = await pack(join(EXTRA, 'linkedin'), avail)
    const version = (
      JSON.parse(readFileSync(join(EXTRA, 'linkedin', 'package.json'), 'utf8')) as {
        version: string
      }
    ).version
    // the copy the person added from an older release: the same connector, an older version
    const { dir: added } = unpack(now, home)
    const pkg = JSON.parse(readFileSync(join(added, 'package.json'), 'utf8'))
    writeFileSync(join(added, 'package.json'), JSON.stringify({ ...pkg, version: '0.9.0' }))
    writeFileSync(join(added, 'OLD'), 'from before')
    const old = await pack(added, join(dir, 'old'))
    renameSync(old, join(avail, 'linkedin-0.9.0.alphaconnector'))
    // offered once, at its newest
    expect(available(home).map((p) => [p.name, p.version])).toEqual([['linkedin', version]])
    expect(updateOwn(home)).toEqual([{ name: 'linkedin', title: 'LinkedIn', version }])
    expect(existsSync(join(added, 'OLD'))).toBe(false)
    expect(JSON.parse(readFileSync(join(added, 'package.json'), 'utf8')).version).toBe(version)
    // the newest already: nothing to do; a folder of the person's own of that name is theirs
    expect(updateOwn(home)).toEqual([])
    writeFileSync(
      join(added, 'package.json'),
      JSON.stringify({ name: 'my-linkedin', version: '0.1.0' }),
    )
    expect(updateOwn(home)).toEqual([])
  })

  it('adds a folder as a copy Alpha keeps, and refuses one that is not a connector', async () => {
    const home = join(dir, 'connectors')
    const added = await addFolder(join(EXTRA, 'linkedin'), home)
    expect(added.dir).toBe(join(home, 'linkedin'))
    expect(existsSync(join(added.dir, 'src', 'index.ts'))).toBe(true)
    mkdirSync(join(dir, 'notes'))
    writeFileSync(join(dir, 'notes', 'package.json'), '{"name":"notes"}')
    await expect(addFolder(join(dir, 'notes'), home)).rejects.toThrow(/not a connector/)
    expect(() => unpack(join(dir, 'notes', 'package.json'), home)).toThrow(/not a connector pack/)
  })
})
