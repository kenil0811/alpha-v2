// A summary's condition in SQL means what the same rule means in the window's filter: both answer
// the cases in filter-cases.ts.
import { DatabaseSync } from 'node:sqlite'
import { describe, expect, it } from 'vitest'
import { FILTER_CASES } from './filter-cases.ts'
import { type FilterOp, ruleSql } from './filter-sql.ts'
import type { FieldKind } from './kinds.ts'

describe('a condition in SQL', () => {
  it.each(FILTER_CASES)('$kind $rule.op $rule.value$rule.values on $value is $match', (c) => {
    const db = new DatabaseSync(':memory:')
    db.exec('CREATE TABLE t (v ANY)')
    const v = c.value
    const stored = Array.isArray(v)
      ? JSON.stringify(v)
      : v && typeof v === 'object'
        ? (v as { amount: number }).amount
        : (v as string | number | null)
    db.prepare('INSERT INTO t (v) VALUES (?)').run(stored)
    const where = ruleSql({ kind: c.kind as FieldKind, tags: !!c.tags }, 'c.v', {
      ...c.rule,
      op: c.rule.op as FilterOp,
    })
    const n = db.prepare(`SELECT count(*) AS n FROM t c WHERE ${where}`).get() as { n: number }
    expect(n.n === 1).toBe(c.match)
    db.close()
  })
})
