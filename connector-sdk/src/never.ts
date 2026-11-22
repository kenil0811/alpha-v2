// The never-use list (rules N1): what is read but never kept. Every connection is given it with
// each call, and its host leaves out a row or a file that matches before it lands, wherever the
// connector runs: in the core, or on a person's computer through the Bridge, so a match never
// leaves that computer. The core's own host leaves it out again as it lands, and counts it.
import type { Host, Item } from './connector.ts'

// The list as one connection meets it: whole words and phrases, and stems found inside a word.
export interface NeverList {
  words: string[] // "chase" never matches "purchase"; "bank statement" matches the two in a row
  stems: string[] // "bank" matches "bankofamerica"
  shapes?: string[] // a key or token by its form, as a regular expression: hf_ and 30 letters
}

const partsOf = (text: string) =>
  text
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter(Boolean)

// Whether some words are on the list, or a key or token is there by its form.
export function onList(text: string, list: NeverList): boolean {
  if (list.shapes?.some((s) => new RegExp(s).test(text))) return true
  const parts = partsOf(text)
  if (!parts.length) return false
  const row = ` ${parts.join(' ')} `
  return (
    list.words.some((w) => {
      const p = partsOf(w)
      return p.length > 1 ? row.includes(` ${p.join(' ')} `) : !!p[0] && parts.includes(p[0])
    }) || list.stems.some((s) => !!s && parts.some((p) => p.includes(s.toLowerCase())))
  )
}

// Every text an item holds, its values' and its lists' alike.
const textsOf = (v: unknown): string[] =>
  typeof v === 'string'
    ? [v]
    : Array.isArray(v)
      ? v.flatMap(textsOf)
      : v && typeof v === 'object'
        ? Object.values(v).flatMap(textsOf)
        : []

export const itemOnList = (item: Item, list: NeverList): boolean =>
  textsOf(item.values).some((t) => onList(t, list))

// A host that leaves out what is on the list before it lands or keeps it, and says how many.
export function withNever(host: Host, list: NeverList): Host {
  if (!list.words.length && !list.stems.length && !list.shapes?.length) return host
  return {
    ...host,
    // read through the host each time: a getter on the core's host (its place) stays live
    get place() {
      return host.place ?? null
    },
    land: (table, items, options) => {
      const kept = items.filter((i) => !itemOnList(i, list))
      if (kept.length < items.length) host.leftOut?.(table, items.length - kept.length)
      return host.land(table, kept, options)
    },
    ...(host.keepFile
      ? {
          keepFile: (name: string, bytes: Uint8Array, mime: string) => {
            if (!onList(name, list))
              return (host.keepFile as NonNullable<Host['keepFile']>)(name, bytes, mime)
            host.leftOut?.('files', 1)
            return { isNew: false }
          },
        }
      : {}),
  }
}
