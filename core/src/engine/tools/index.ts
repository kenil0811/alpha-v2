// The world tools (design §5), as entries of the tool registry (decision 11): the Agent SDK
// serves them in process, and Alpha's own loop calls them directly. Each declares its effect,
// which the gate adapter maps to the gates; each writes through the world, which journals and
// checks provenance. Grouped by what they touch, in the files here.
import type { ConnectorService } from '../../connectors/service.ts'
import type { World } from '../../world/world.ts'
import type { ToolEntry } from '../registry.ts'
import { EFFECTS, type Hands, type Here, type Tooling } from './common.ts'
import { deskTools } from './desk.ts'
import { rowTools } from './rows.ts'
import { shapeTools } from './shape.ts'
import { taskTools } from './task.ts'

export {
  EFFECTS,
  type Hands,
  type Here,
  instructionsFile,
  SERVER,
  type TurnContext,
} from './common.ts'
export { applyShape, describeShape, MAINTAINED_SHAPE, type ShapeAction } from './shape.ts'

export function worldTools(
  world: World,
  here: Here,
  hands?: Hands,
  connectors?: ConnectorService,
): ToolEntry[] {
  const t: Tooling = {
    world,
    here,
    hands,
    connectors,
    ctx: () => ({
      actor: { kind: 'alpha' as const },
      user: here.current.user.id,
      turn: here.current.turn,
      said: here.fromSubagent ? null : here.current.said,
    }),
  }
  // in the order the model has always read them
  const [query, search, ...rows] = rowTools(t)
  const [ask, remember, ...rest] = deskTools(t)
  return [query, search, ...shapeTools(t), ...rows, ask, remember, ...taskTools(t), ...rest].filter(
    (x): x is ToolEntry => !!x,
  )
}

export const TOOL_NAMES = Object.keys(EFFECTS).sort()
