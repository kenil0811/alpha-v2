// Every connector action declares its effect; the core's gates read it.

export const EFFECTS = ['read', 'write', 'remove', 'outward', 'sign_in'] as const

export type Effect = (typeof EFFECTS)[number]

export function isEffect(value: unknown): value is Effect {
  return typeof value === 'string' && (EFFECTS as readonly string[]).includes(value)
}
