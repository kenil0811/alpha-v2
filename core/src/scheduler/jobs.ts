// The jobs a rule needs to reach as the scheduler runs them (docs/rules.md, R2).
import { copyNewestBackup } from '../data.ts'
import { backupDaily } from '../world/backups.ts'
import type { World } from '../world/world.ts'
import type { Due } from './scheduler.ts'

// The world backed up once a day, the last 7 days and 4 weeks kept, and a copy of the newest in the
// person's folder where they named one. One failure is a card the same day.
export function backupJob(world: World, copyTo: () => string | null | undefined): Due {
  return {
    name: 'The daily backup',
    cardAfter: 1,
    run: async () => {
      const paths = { files: world.paths.files, modules: world.paths.modules }
      const made = await backupDaily(world.db, world.paths.backups, new Date(), paths)
      if (made) console.log(`Backed up the world: ${made}`)
      const to = copyTo()
      if (!to) return
      const copied = copyNewestBackup(world.paths.backups, to, paths)
      if (copied) console.log(`Copied the newest backup to ${copied}`)
    },
  }
}
