// The one module that touches Node's SQLite (design §3: it is still a release candidate, so the
// world wraps it here and better-sqlite3 stays the fallback).
import { randomBytes } from 'node:crypto'
import { DatabaseSync } from 'node:sqlite'

export type Db = DatabaseSync
export type Row = Record<string, unknown>

export function openDb(file: string, options: { readOnly?: boolean } = {}): Db {
  const db = new DatabaseSync(file, { readOnly: options.readOnly ?? false, timeout: 5000 })
  if (!options.readOnly) {
    db.exec('PRAGMA journal_mode = WAL')
    db.exec('PRAGMA foreign_keys = ON')
  }
  return db
}

// One logical change is one transaction, the read it depends on included. Nested calls join the
// transaction already open.
export function tx<T>(db: Db, fn: () => T): T {
  if (db.isTransaction) return fn()
  db.exec('BEGIN IMMEDIATE')
  try {
    const out = fn()
    db.exec('COMMIT')
    return out
  } catch (err) {
    db.exec('ROLLBACK')
    throw err
  }
}

export function all<T = Row>(db: Db, sql: string, ...params: SqlValue[]): T[] {
  return db.prepare(sql).all(...params) as T[]
}

export function one<T = Row>(db: Db, sql: string, ...params: SqlValue[]): T | undefined {
  return db.prepare(sql).get(...params) as T | undefined
}

export function run(db: Db, sql: string, ...params: SqlValue[]) {
  return db.prepare(sql).run(...params)
}

export type SqlValue = string | number | bigint | null | Uint8Array

export function now(): string {
  return new Date().toISOString()
}

const ALPHABET = '0123456789abcdefghjkmnpqrstvwxyz'

// Short ids with a prefix that says what they name: r_ a record, t_ a table, c_ a card.
export function newId(prefix: string): string {
  const bytes = randomBytes(10)
  let out = ''
  for (const b of bytes) out += ALPHABET[b % 32]
  return `${prefix}_${out}`
}

export function json(value: unknown): string {
  return JSON.stringify(value ?? null)
}

export function parse<T>(text: unknown, fallback: T): T {
  if (typeof text !== 'string') return fallback
  try {
    return JSON.parse(text) as T
  } catch {
    return fallback
  }
}
