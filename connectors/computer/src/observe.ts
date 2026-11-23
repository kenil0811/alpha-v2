// Watching the person's work on their computer: the front app and its window's title every few
// seconds, never a screenshot (Vikas, 23 Nov). Not built: it waits on Kenil's decision, so this
// stub refuses every time. Only the core's wall (core/src/world/observe.ts) may ever call it: Alpha
// Bridge connected and staying on, and the person's own yes, kept with who and when.
import { Problem } from '@alpha/connector-sdk'

export const NOT_BUILT =
  'Watching the front app is not built yet: it waits on a decision. Nothing was watched.'

export function watchFrontApp(): never {
  throw new Problem(NOT_BUILT)
}
