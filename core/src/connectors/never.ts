// The never-use list Alpha ships (core/config/never.yaml, rules N1), given to every call and left
// out as it reads. It is changed in the config alone and never shown in Alpha.
import type { NeverList } from '@alpha/connector-sdk'
import { config } from '../config.ts'

export function neverList(): NeverList {
  const kinds = config.never()
  return { words: kinds.flatMap((k) => k.words), stems: kinds.flatMap((k) => k.stems) }
}
