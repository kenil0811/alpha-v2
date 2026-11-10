import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { FILE, readInstall, writeInstall } from './install.ts'

let home: string
beforeEach(() => {
  home = mkdtempSync(join(tmpdir(), 'alpha-install-'))
})
afterEach(() => rmSync(home, { recursive: true, force: true }))

describe('the install file', () => {
  it('knows a server’s own address', () => {
    writeFileSync(join(home, FILE), 'public_address: "https://alpha.example.ts.net"\n')
    expect(readInstall(home, {}).publicAddress).toBe('https://alpha.example.ts.net')
  })

  it('has its defaults with no file, and the file’s say when there is one', () => {
    expect(readInstall(home, {})).toMatchObject({ owner: null, port: 4700, keepAwake: false })
    writeFileSync(
      join(home, FILE),
      'owner: Kenil\nport: 4710\nreport_to: hello@example.com\nkeep_awake: true\n',
    )
    expect(readInstall(home, {})).toMatchObject({
      owner: 'Kenil',
      port: 4710,
      reportTo: 'hello@example.com',
      keepAwake: true,
      prepareReaders: false,
    })
  })

  it('lets the environment win over the file, for a development run', () => {
    writeFileSync(join(home, FILE), 'owner: Kenil\nport: 4710\nkeep_awake: true\n')
    expect(
      readInstall(home, { ALPHA_PORT: '4700', ALPHA_OWNER: 'Priya', ALPHA_KEEP_AWAKE: '0' }),
    ).toMatchObject({ owner: 'Priya', port: 4700, keepAwake: false })
    expect(readInstall(home, { ALPHA_PORT: 'x' }).port).toBe(4710)
  })

  it('writes back what was learned and keeps the other lines', () => {
    writeFileSync(join(home, FILE), 'owner: Kenil\nreport_to: hello@example.com\n')
    writeInstall(home, { tenant: 't_1', keepAwake: false })
    expect(readInstall(home, {})).toMatchObject({
      owner: 'Kenil',
      reportTo: 'hello@example.com',
      tenant: 't_1',
      keepAwake: false,
    })
    expect(readFileSync(join(home, FILE), 'utf8')).toMatch(/^# What the installer knows/)
    writeInstall(join(home, 'fresh'), { port: 4701 })
    expect(readInstall(join(home, 'fresh'), {}).port).toBe(4701)
  })

  it('refuses a file that is not right, in words', () => {
    writeFileSync(join(home, FILE), 'port: soon\n')
    expect(() => readInstall(home, {})).toThrow(/alpha.yaml is not right/)
  })
})
