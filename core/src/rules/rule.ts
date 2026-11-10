// A rule of docs/rules.md as its test (R3): tried through every door that can do what it is about,
// on a fresh rule world each, and in named cases where a door is not the point. What does not
// hold yet names what it waits on: its test passes only while the rule still fails there, so the
// day a build makes it hold, the test fails until its mark comes off, here and in docs/rules.md. A
// case whose way in is written later is named now, as a todo.
import { describe, expect, it } from 'vitest'
import { Refused } from '../world/kinds.ts'
import { marks } from './check.ts'
import { type Act, DOORS, type Door, door } from './doors.ts'
import { type Acts, DRIVERS } from './drive.ts'
import { RuleWorld } from './world.ts'

type WorldOf = Parameters<typeof RuleWorld.open>

export interface Spec {
  world?: WorldOf
  // a door rule: each door that can do these, but those the rule is not about
  acts?: Act[]
  doors?: (d: Door) => boolean
  given?: (w: RuleWorld, d: Door) => Promise<void> | void
  attempt?: (a: Acts, act: Act, d: Door, w: RuleWorld) => Promise<unknown>
  holds?: (w: RuleWorld, refused: string | null, act: Act, d: Door) => boolean | Promise<boolean>
  // named cases, each saying whether the rule holds
  cases?: Record<string, (w: RuleWorld) => Promise<boolean>>
  // what does not hold yet, by its case's name or its door's: what it waits on, in words
  waits?: Record<string, string>
  // cases whose way in is written later, by what they wait on
  later?: Record<string, string>
}

// What the rules not held yet wait on.
export const CONTRACT = "Dell's contract"

// A door's acts, each one it cannot do a broken test rather than a refusal.
function actsOf(d: Door, w: RuleWorld): Acts {
  const given = DRIVERS[d.name]?.(w) ?? {}
  return new Proxy(given, {
    get: (o, k: string) => {
      const f = (o as Record<string, unknown>)[k]
      if (typeof f !== 'function') throw new Error(`${d.name} has no driver for ${k}.`)
      return f
    },
  }) as Acts
}

function tryOne(
  ruleId: string,
  name: string,
  step: string | undefined,
  world: WorldOf | undefined,
  run: (w: RuleWorld) => Promise<boolean>,
): void {
  it(`${ruleId} · ${name}${step ? ` (waits on ${step})` : ''}`, async () => {
    const w = await RuleWorld.open(...(world ?? []))
    try {
      const held = await run(w)
      if (step)
        expect(
          held,
          `${ruleId} holds now at ${name}: take its waits mark off, here and in docs/rules.md`,
        ).toBe(false)
      else expect(held, `${ruleId} does not hold at ${name}`).toBe(true)
    } finally {
      await w.close()
    }
  })
}

export function rule(ruleId: string, words: string, spec: Spec): void {
  describe(`${ruleId}: ${words} (docs/rules.md)`, () => {
    const names: string[] = []
    const stepOf = (...keys: string[]) => keys.map((k) => spec.waits?.[k]).find((s) => s)
    for (const act of spec.acts ?? [])
      for (const d of DOORS.filter((x) => x.can.includes(act) && (spec.doors?.(x) ?? true))) {
        const name = (spec.acts?.length ?? 0) > 1 ? `${d.name} (${act})` : d.name
        names.push(name, d.name)
        tryOne(ruleId, name, stepOf(name, d.name), spec.world, async (w) => {
          await spec.given?.(w, d)
          let refused: string | null = null
          try {
            await spec.attempt?.(actsOf(d, w), act, d, w)
          } catch (err) {
            if (!(err instanceof Refused)) throw err
            refused = err.message
          }
          return (await spec.holds?.(w, refused, act, d)) ?? false
        })
      }
    for (const [name, run] of Object.entries(spec.cases ?? {})) {
      names.push(name)
      tryOne(ruleId, name, stepOf(name), spec.world, run)
    }
    for (const [name, step] of Object.entries(spec.later ?? {}))
      it.todo(`${ruleId} · ${name} (written with ${step})`)

    it(`${ruleId} is marked in docs/rules.md as its tests find it`, () => {
      for (const k of Object.keys(spec.waits ?? {}))
        expect(names, `${k} waits, but ${ruleId} tries nothing by that name`).toContain(k)
      const on = [
        ...new Set([...Object.values(spec.waits ?? {}), ...Object.values(spec.later ?? {})]),
      ].sort()
      const want = on.length ? `skip (${on.join(', ')})` : 'test'
      expect(marks().get(ruleId)).toBe(want)
    })
  })
}

// Whether a door refused in words that say why: the rule's own words, never a broken test's.
export const refusedWith = (refused: string | null, words: RegExp): boolean =>
  refused !== null && words.test(refused)

// A door by its name, driven in a world: what a case tries through it.
export const drive = (w: RuleWorld, name: string): Acts => actsOf(door(name), w)

// A door's refusal, in its words; none when it let the change in.
export async function refusal(f: () => unknown): Promise<string | null> {
  try {
    await f()
    return null
  } catch (err) {
    if (err instanceof Refused) return err.message
    throw err
  }
}
