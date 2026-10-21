// The log's rotation: the newest file first, five kept.
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { rotate } from './log.ts'

describe('the log', () => {
  it('rotates to core.log.1 and keeps five files', () => {
    const dir = mkdtempSync(join(tmpdir(), 'alpha-log-'))
    const file = join(dir, 'core.log')
    for (let n = 1; n <= 7; n++) {
      writeFileSync(file, `round ${n}`)
      rotate(file)
    }
    expect(readFileSync(`${file}.1`, 'utf8')).toBe('round 7')
    expect(readFileSync(`${file}.4`, 'utf8')).toBe('round 4')
    expect(existsSync(`${file}.5`)).toBe(false)
    rmSync(dir, { recursive: true, force: true })
  })
})
