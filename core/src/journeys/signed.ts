// A kit installed from a pack signed with a key the journey makes, as a release's would be by
// Kenil's (rules M1): never his key, and the world trusts this one for this install only.
import { generateKeyPairSync } from 'node:crypto'
import { join } from 'node:path'
import { readKit } from '../modules/kits/index.ts'
import { installPack, pack } from '../modules/packs.ts'
import { signPack } from '../signing.ts'
import type { Module, WriteCtx } from '../world/shape/index.ts'
import type { World } from '../world/world.ts'

export async function installSigned(
  world: World,
  folder: string,
  home: string,
  ctx: WriteCtx,
): Promise<Module> {
  const key = generateKeyPairSync('ed25519')
  const file = signPack(
    pack(folder, join(home, 'packs')),
    key.privateKey.export({ type: 'pkcs8', format: 'pem' }).toString(),
  )
  await installPack(world, file, join(home, 'kits'), ctx, {
    developer: false,
    key: key.publicKey.export({ type: 'spki', format: 'pem' }).toString(),
  })
  return world.shape.ownModule(readKit(folder).manifest.name) as Module
}
