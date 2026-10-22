// Writes docs/kit-api.md and the JSON schemas of module.yaml and an agent's front matter from
// the kit API (kit-sdk); a test keeps them the same as the code.
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { AgentFront, Manifest, reference } from '@alpha/kit-sdk'
import { z } from 'zod'

const docs = join(import.meta.dirname, '..', 'docs')
writeFileSync(join(docs, 'kit-api.md'), reference())
mkdirSync(join(docs, 'kit-schemas'), { recursive: true })
writeFileSync(
  join(docs, 'kit-schemas', 'module.yaml.json'),
  `${JSON.stringify(z.toJSONSchema(Manifest, { io: 'input' }), null, 2)}\n`,
)
writeFileSync(
  join(docs, 'kit-schemas', 'agent.json'),
  `${JSON.stringify(z.toJSONSchema(AgentFront, { io: 'input' }), null, 2)}\n`,
)
console.log('docs/kit-api.md and docs/kit-schemas written')
