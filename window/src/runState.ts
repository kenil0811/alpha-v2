// A run's state in words and tone, one map every place reads: Activity's pill and its filter, an
// agent's runs on a task, the parts page (Batch A, pick 9: "Failed" everywhere, Kenil 1 Nov).
import type { RunView } from '@alpha/core/api'
import type { Tone } from './ui/pill.tsx'

export const RUN_STATE: Record<RunView['state'], [string, Tone]> = {
  running: ['Running', 'accent'],
  ok: ['Done', 'good'],
  failed: ['Failed', 'bad'],
  stopped: ['Stopped', 'neutral'],
}
