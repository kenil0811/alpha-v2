// What a module page says about where a module came from and when something ran. Modules are in the
// rail, each with its Setup; installing one is New module's. The core calls a module's package a
// kit; a person never reads that word.
import type { WorkingModuleView } from '@alpha/core/api'
import { Package } from 'lucide-react'
import { type FormEvent, useCallback, useEffect, useRef, useState } from 'react'
import { api, Problem, wordsOf } from './api.ts'
import { Button } from './ui/button.tsx'
import { Field } from './ui/field.tsx'
import { List, Row, Tile } from './ui/list.tsx'
import { Section } from './ui/section.tsx'

export function when(at: string | null): string {
  if (!at) return 'not yet'
  return new Date(at).toLocaleString(undefined, {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}

// Where a module came from: Alpha's own, installed (with its version and maintainer), or made in a
// conversation.
export function originWords(
  from: {
    name: string
    version: string
    maintainer?: { name: string } | null
    core?: boolean
    changes?: number
  } | null,
): string {
  if (!from) return 'Made in a conversation'
  if (from.core) return `Alpha's own, version ${from.version}`
  const by = from.maintainer ? `, maintained by ${from.maintainer.name}` : ''
  const unseen = from.changes
    ? ` · ${from.changes} ${from.changes === 1 ? 'change of yours' : 'of your changes'} its maker hasn't seen`
    : ''
  return `From ${from.name}, version ${from.version}${by}${unseen}`
}

const scheduleWords = (m: WorkingModuleView): string => {
  if (!m.schedules.length) return ''
  const on = m.schedules.filter((a) => a.state === 'on').length
  const all = m.schedules.length
  return ` · ${all === 1 ? 'one schedule' : `${all} schedules`}, ${
    on === all ? (on === 1 ? 'on' : 'all on') : on ? `${on} on` : 'paused'
  }`
}
