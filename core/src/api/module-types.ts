// A module's code and know-how, and the other modules it reads or is read by, as Module details
// shows them (the definitions, 27 Nov), and a module inside another as its parent lists it.
import type { ModuleSummary } from './types.ts'

export interface ModuleScript {
  name: string
  runBy: string[] // the schedules that run it
}

export interface ModuleSkill {
  name: string
  description: string
}

// Another module, with the tables read; no id: not on this Alpha.
export interface ModuleRead {
  id: string | null
  name: string
  tables: string[]
}

// A module inside another, as the parent's Overview lists it: where it comes from and what goes on in it now, the modules inside it counted too.
export interface InsideModuleView extends ModuleSummary {
  kit: string | null
  schedules: number // on
  running: number
  needs: number // cards waiting on the person
  tasks: number // open
}
