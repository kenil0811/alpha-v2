// Files by hash beside the world, and documents with chunks and positions.
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { all, type Db, json, newId, now, one, parse, run, tx } from './db.ts'
import { append } from './journal.ts'
import { Refused } from './kinds.ts'
import { actorName, type WriteCtx } from './shape/index.ts'

export interface Position {
  sheet?: string
  cell?: string
  row?: number
  line?: number
  page?: number
  box?: [number, number, number, number]
}

export interface ChunkInput {
  position: Position
  words: string
}

export interface FileOut {
  hash: string
  name: string
  size: number
  mime: string
}

export interface DocumentOut {
  id: string
  fileHash: string
  title: string
  kind: string
  chunks: number
}

export class Files {
  private db: Db
  private dir: string

  constructor(db: Db, dir: string) {
    this.db = db
    this.dir = dir
  }

  hashOf(bytes: Uint8Array): string {
    return createHash('sha256').update(bytes).digest('hex')
  }

  path(hash: string): string {
    return join(this.dir, hash.slice(0, 2), hash)
  }

  // A file kept by its hash: the same bytes twice are one file.
  take(
    bytes: Uint8Array,
    name: string,
    mime: string,
    ctx: WriteCtx,
  ): { file: FileOut; isNew: boolean } {
    const hash = createHash('sha256').update(bytes).digest('hex')
    return tx(this.db, () => {
      const known = this.file(hash)
      if (known) return { file: known, isNew: false }
      const p = this.path(hash)
      mkdirSync(join(this.dir, hash.slice(0, 2)), { recursive: true })
      if (!existsSync(p)) writeFileSync(p, bytes)
      run(
        this.db,
        'INSERT INTO files (hash, name, size, mime, added_by, added_at) VALUES (?, ?, ?, ?, ?, ?)',
        hash,
        name,
        bytes.byteLength,
        mime,
        actorName(ctx.actor),
        now(),
      )
      append(this.db, {
        actor: ctx.actor,
        kind: 'filed',
        words: `Kept the file ${name}.`,
        data: { file: hash, name, size: bytes.byteLength, mime },
        user: ctx.user ?? null,
        turn: ctx.turn ?? null,
        run: ctx.run ?? null,
      })
      return { file: this.file(hash) as FileOut, isNew: true }
    })
  }

  // A file kept for a look and not wanted (an attachment declined): gone with its bytes, when
  // nothing holds it (no document read from it, no row it sits on). The journal says it was here.
  removeUnheld(hash: string, why: string, ctx: WriteCtx): boolean {
    return tx(this.db, () => {
      const f = this.file(hash)
      if (!f) return false
      const held =
        one(this.db, 'SELECT 1 FROM documents WHERE file_hash = ?', hash) ??
        one(this.db, 'SELECT 1 FROM row_files WHERE file_hash = ?', hash)
      if (held) return false
      run(this.db, 'DELETE FROM files WHERE hash = ?', hash)
      rmSync(this.path(hash), { force: true })
      append(this.db, {
        actor: ctx.actor,
        kind: 'removed',
        words: `Let go of ${f.name}: ${why}`,
        data: { file: hash, name: f.name },
        user: ctx.user ?? null,
        turn: ctx.turn ?? null,
        run: ctx.run ?? null,
      })
      return true
    })
  }

  file(hash: string): FileOut | undefined {
    return one<FileOut>(this.db, 'SELECT hash, name, size, mime FROM files WHERE hash = ?', hash)
  }

  findFile(nameOrHash: string): FileOut | undefined {
    return one<FileOut>(
      this.db,
      'SELECT hash, name, size, mime FROM files WHERE hash = ? OR name = ? ORDER BY added_at DESC',
      nameOrHash,
      nameOrHash,
    )
  }

  bytes(hash: string): Buffer {
    if (!this.file(hash)) throw new Refused('That file is not there.')
    return readFileSync(this.path(hash))
  }

  document(fileHash: string): DocumentOut | undefined {
    const d = one<{ id: string; file_hash: string; title: string; kind: string }>(
      this.db,
      'SELECT id, file_hash, title, kind FROM documents WHERE file_hash = ?',
      fileHash,
    )
    if (!d) return undefined
    const n = Number(
      one<{ n: number }>(this.db, 'SELECT count(*) AS n FROM chunks WHERE document_id = ?', d.id)
        ?.n ?? 0,
    )
    return { id: d.id, fileHash: d.file_hash, title: d.title, kind: d.kind, chunks: n }
  }

  addDocument(
    fileHash: string,
    title: string,
    kind: string,
    chunks: ChunkInput[],
    ctx: WriteCtx,
  ): DocumentOut {
    return tx(this.db, () => {
      if (!this.file(fileHash)) throw new Refused('That file is not there.')
      const known = this.document(fileHash)
      if (known) return known
      const id = newId('d')
      run(
        this.db,
        'INSERT INTO documents (id, file_hash, title, kind, made_by, created_at) VALUES (?, ?, ?, ?, ?, ?)',
        id,
        fileHash,
        title,
        kind,
        actorName(ctx.actor),
        now(),
      )
      const insert = this.db.prepare(
        'INSERT INTO chunks (document_id, position, words) VALUES (?, ?, ?)',
      )
      for (const c of chunks) insert.run(id, json(c.position), c.words)
      append(this.db, {
        actor: ctx.actor,
        kind: 'filed',
        words: `Read ${title}: ${chunks.length} ${kind === 'sheet' ? 'cells' : 'lines'} with their places.`,
        data: { document: id, file: fileHash, kind, chunks: chunks.length },
        user: ctx.user ?? null,
        turn: ctx.turn ?? null,
        run: ctx.run ?? null,
      })
      return this.document(fileHash) as DocumentOut
    })
  }

  chunks(documentId: string): { position: Position; words: string }[] {
    return all<{ position: string; words: string }>(
      this.db,
      'SELECT position, words FROM chunks WHERE document_id = ? ORDER BY id',
      documentId,
    ).map((c) => ({ position: parse(c.position, {}), words: c.words }))
  }

  documents(): DocumentOut[] {
    return all<{ file_hash: string }>(
      this.db,
      'SELECT file_hash FROM documents ORDER BY created_at',
    ).map((d) => this.document(d.file_hash) as DocumentOut)
  }
}
