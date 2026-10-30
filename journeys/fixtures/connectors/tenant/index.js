// A made-up connector for the journey connection-waits (step 2, part 4): its check says the
// customer's IT must approve Alpha first, until a file named `approved` is in the folder it is
// connected to, which the journey writes when the customer has done their step.
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { Problem } from '@alpha/connector-sdk'

export const connector = {
  manifest: {
    name: 'tenant',
    title: 'Tenant',
    auth: 'path',
    account: { label: 'Folder' },
    pace: { perMinute: 600 },
    syncEveryMinutes: 1,
  },
  guide: '# Tenant\n\nA made-up service a customer’s IT must approve.',
  module: 'Tenant',
  tables: [{ name: 'Tenant rows', fields: [{ name: 'Note', kind: 'text' }] }],
  tools: {},
  check: async (c) => {
    if (!existsSync(join(c.host.account, 'approved')))
      throw new Problem('Your IT has to approve Alpha for the tenant.', 'waiting')
  },
  sync: async (c) => {
    const landed = await c.host.land('Tenant rows', [{ key: 'one', values: { Note: 'Read.' } }])
    return { rows: 1, sawNew: landed.added > 0 }
  },
}
