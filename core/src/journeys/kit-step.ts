// A journey's kit step: a kit installed from a folder (signed with the journey's own key where it
// says so) or a newer version of one already there, its schedules on as the step says.
import { install, readKit, update } from '../modules/kits/index.ts'
import { schedules, setScheduleState } from '../modules/schedules.ts'
import type { Module } from '../world/shape/index.ts'
import type { World } from '../world/world.ts'
import { installSigned } from './signed.ts'

export interface KitStep {
  from: string
  schedules: 'on' | 'paused' | string[]
  signed?: boolean | undefined
  update?: boolean | undefined
}

// What it did, in words; a kit the core refuses throws its refusal.
export async function kitStep(
  world: World,
  step: KitStep,
  from: string,
  home: string,
  user: string,
): Promise<string> {
  const person = { actor: { kind: 'person' as const, id: user }, user }
  const name = readKit(from).manifest.name
  if (step.update) await update(world, name, from, person)
  const m = step.update
    ? (world.shape.ownModule(name) as Module)
    : step.signed
      ? await installSigned(world, from, home, person)
      : await install(world, from, person)
  const on = step.schedules
  for (const a of schedules(world, m.id))
    setScheduleState(
      world,
      a.id,
      Array.isArray(on) ? (on.includes(a.name) ? 'on' : 'paused') : on,
      user,
    )
  return `${step.update ? 'Updated to' : 'Installed'} the kit ${step.from}, ${Array.isArray(on) ? `${on.join(', ')} on` : `its schedules ${on}`}`
}
