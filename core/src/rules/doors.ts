// Every way in that can change a row or a module (docs/rules.md, R3). A rule's test tries the rule
// through each door that can do what the rule is about (`can`, each with its driver in
// drive.ts), and R3 fails on a route, a tool or a plugin call that writes and is named neither
// here nor in NOT_DOORS. A route is its method and path as the core registers it, `*` standing for
// a part worked out in code; a tool is `tool <name>`; a plugin's call is `plugin <call>`.

// What a door can do that a rule is about.
export type Act =
  | 'set' // change a value on a row
  | 'clear' // empty a value on a row
  | 'add' // add a row
  | 'remove' // remove a row
  | 'reset' // put a machine's value back over the person's
  | 'land' // meet an item again by its own key, as a reader or a connection does
  | 'revert' // undo what a run wrote
  | 'addField' // a new field on a table
  | 'renameTable'
  | 'renameField'
  | 'describe' // a table's sentence on what its rows are
  | 'keep' // a file in a module: a schedule, a skill, a page, NOTES.md

export interface Door {
  name: string
  by: 'person' | 'alpha' | 'schedule' | 'connector' | 'plugin' | 'kit'
  changes: 'rows' | 'module'
  where: string[]
  can: Act[]
}

export const DOORS: Door[] = [
  // rows and their values
  {
    name: 'window: set a value',
    by: 'person',
    changes: 'rows',
    where: ['POST /api/tables/:id/rows/:row'],
    can: ['set', 'clear'],
  },
  {
    name: 'window: add a row',
    by: 'person',
    changes: 'rows',
    where: ['POST /api/tables/:id/rows'],
    can: ['add'],
  },
  {
    name: 'window: paste',
    by: 'person',
    changes: 'rows',
    where: ['POST /api/tables/:id/rows/many'],
    can: ['set', 'add'],
  },
  {
    name: 'window: remove',
    by: 'person',
    changes: 'rows',
    where: ['POST /api/tables/:id/rows/remove'],
    can: ['remove'],
  },
  {
    name: 'window: Reset',
    by: 'person',
    changes: 'rows',
    where: ['POST /api/tables/:id/rows/:row/reset'],
    can: ['reset'],
  },
  {
    name: 'window: files on a row',
    by: 'person',
    changes: 'rows',
    where: [
      'POST /api/files',
      'POST /api/tables/:id/rows/:row/files',
      'POST /api/tables/:id/rows/:row/files/:hash',
    ],
    can: [],
  },
  {
    name: 'window: a kept list (people, schedules, tasks)',
    by: 'person',
    changes: 'rows',
    where: [
      'POST /api/kept/*/rows/:id',
      'POST /api/kept/schedules/rows/:id',
      'POST /api/kept/tasks/rows/:id',
      'POST /api/tasks',
      'POST /api/tasks/:id',
      'POST /api/tasks/:id/state',
      'DELETE /api/tasks/:id',
    ],
    can: [],
  },
  {
    name: 'window: a person’s own value per table',
    by: 'person',
    changes: 'rows',
    where: ['POST /api/people/:id/per/:table'],
    can: [],
  },
  {
    name: 'window: a card’s answer',
    by: 'person',
    changes: 'rows',
    where: [
      'POST /api/cards/:id',
      'POST /api/cards/:id/rows',
      'POST /api/cards/:id/tasks',
      'POST /api/cards/:id/send',
      'POST /api/cards/:id/hold',
      'POST /api/cards/:id/file',
      'POST /api/cards/:id/decline',
      'POST /api/cards/:id/merge-same',
      'POST /api/cards/:id/sign-in',
    ],
    can: [],
  },
  {
    name: 'window: Revert, Bring back',
    by: 'person',
    changes: 'rows',
    where: ['POST /api/undo'],
    can: ['revert'],
  },
  {
    name: 'window: Read now',
    by: 'person',
    changes: 'rows',
    // what it brings in comes through the connector's landing, tried there
    where: ['POST /api/connections/:id/sync', 'POST /api/tables/:id/read'],
    can: [],
  },
  { name: 'alpha: write', by: 'alpha', changes: 'rows', where: ['tool write'], can: ['add'] },
  {
    name: 'alpha: change',
    by: 'alpha',
    changes: 'rows',
    where: ['tool change'],
    can: ['set', 'clear', 'remove'],
  },
  { name: 'alpha: file', by: 'alpha', changes: 'rows', where: ['tool file'], can: [] },
  { name: 'alpha: task', by: 'alpha', changes: 'rows', where: ['tool task'], can: [] },
  {
    name: 'schedule: a script',
    by: 'schedule',
    changes: 'rows',
    where: ['the scripts’ API (modules/runs/api.ts)'],
    can: ['set', 'add', 'land'],
  },
  {
    name: 'connector: landing',
    by: 'connector',
    changes: 'rows',
    where: ['the connector service’s land (connectors/service.ts)'],
    can: ['set', 'add', 'land'],
  },
  {
    name: 'plugin: own rows',
    by: 'plugin',
    changes: 'rows',
    where: ['plugin own.add', 'plugin own.set'],
    can: ['add'],
  },
  {
    name: 'people: merge and unmerge',
    by: 'person',
    changes: 'rows',
    where: [
      'POST /api/people/:id/name',
      'POST /api/people/:id/unmerge',
      'POST /api/people/:id/not',
      'POST /api/people/:id/you',
      'POST /api/people/pairs/:id',
    ],
    can: [],
  },

  // a module's shape and its files
  {
    name: 'alpha: shape',
    by: 'alpha',
    changes: 'module',
    where: ['tool shape'],
    can: ['addField', 'renameTable', 'renameField', 'describe'],
  },
  { name: 'alpha: keep', by: 'alpha', changes: 'module', where: ['tool keep'], can: ['keep'] },
  {
    name: 'window: a table’s about, name, fields, tab',
    by: 'person',
    changes: 'module',
    where: [
      'POST /api/tables/:id/about',
      'POST /api/tables/:id/name',
      'POST /api/tables/:id/fields',
      'POST /api/tables/:id/tab',
      'POST /api/tables/:id/sidebar',
    ],
    // a field is renamed by asking Alpha; the window renames the table only
    can: ['addField', 'renameTable', 'describe'],
  },
  {
    name: 'window: a module’s name, business case, place',
    by: 'person',
    changes: 'module',
    where: [
      'POST /api/modules/:id/name',
      'POST /api/modules/:id/case',
      'POST /api/modules/:id/place',
    ],
    can: [],
  },
  {
    name: 'window: a kit’s fields and version',
    by: 'person',
    changes: 'module',
    where: [
      'POST /api/kits/:module/update',
      'POST /api/kits/:module/make',
      'POST /api/kits/:module/yours/back',
      'POST /api/kits/:module/fields/remove',
    ],
    can: [],
  },
  {
    name: 'window: schedules',
    by: 'person',
    changes: 'module',
    where: [
      'POST /api/schedules/:id',
      'POST /api/schedules/:id/run',
      'POST /api/modules/:id/schedules',
    ],
    can: [],
  },
  {
    name: 'window: install or pack',
    by: 'person',
    changes: 'module',
    where: [
      'POST /api/kits',
      'POST /api/kits/pack',
      'POST /api/connectors',
      'POST /api/connectors/pack',
      'DELETE /api/connectors/:name',
    ],
    can: [],
  },
  {
    name: 'window: admin',
    by: 'person',
    changes: 'module',
    where: [
      'POST /api/data/restore',
      'POST /api/data/import',
      'POST /api/data/remove',
      'POST /api/model',
      'POST /api/setup/signin',
      'POST /api/setup/settings',
      'POST /api/setup/prepare',
      'POST /api/setup/awake',
      'POST /api/sign-in-apps/:provider',
    ],
    can: [],
  },
  {
    name: 'kit: install and update',
    by: 'kit',
    changes: 'module',
    where: ['modules/kits/install.ts'],
    can: ['addField'],
  },
  {
    name: 'connector: its tables',
    by: 'connector',
    changes: 'module',
    where: [
      'connectors/places.ts',
      'POST /api/connections',
      'DELETE /api/connections/:id',
      'POST /api/connections/:id/sign-in',
      'tool connect',
      'plugin connect',
    ],
    can: [],
  },
  {
    name: 'plugin: its own module',
    by: 'plugin',
    changes: 'module',
    where: ['plugins/plugins.ts keepKits'],
    can: [],
  },
]

// What writes, but changes neither a row nor a module, and why it is not a door.
export const NOT_DOORS: Record<string, string> = {
  'POST /api/undo/preview': 'says what a revert would do, and does nothing',
  'POST /api/session': 'a person signing in',
  'POST /api/session/out': 'a person signing out',
  'POST /api/session/link': 'a person setting their password from a link',
  'POST /api/accounts': 'the owner adding a person who may sign in',
  'POST /api/accounts/:id/link': 'the owner making a new sign-in link',
  'POST /api/accounts/:id/remove': 'the owner removing a person’s way in; their history stays',
  'POST /api/runs/:id/stop': 'stops a run under way; what it wrote stays',
  'POST /api/connections/:id/allow': 'a host a connection may reach, held by its gate',
  'POST /api/layout': 'how the person left the window',
  'POST /api/appearance': 'how the window looks to the person',
  'POST /api/modules/:id/pages/:name/ask': 'a question about a page, answered in a conversation',
  'POST /api/modules/:id/pages/:name/pdf': 'a page printed',
  'POST /api/rules/:id/*': 'a rule’s yes or no, which the gates hold',
  'POST /api/instructions/remove': 'a standing instruction, the person’s words',
  'POST /api/instructions/change': 'a standing instruction, the person’s words',
  'POST /api/data/backup': 'a copy of the world; nothing in it changes',
  'POST /api/data/export': 'the person’s data taken out; nothing in it changes',
  'POST /api/say': 'a message to Alpha; what Alpha does goes through its tools, each a door',
  'POST /api/stop': 'stops Alpha’s reply',
  'POST /api/tables/:id/rows/goes': 'says what a removal takes with it, and does nothing',
  'POST /api/tables/:id/export': 'a table taken out as a file',
  'POST /api/tables/:id/views': 'a saved list, the person’s own arrangement',
  'PUT /api/views/:id': 'a saved list, the person’s own arrangement',
  'DELETE /api/views/:id': 'a saved list, the person’s own arrangement',
  'tool query': 'reads',
  'tool search': 'reads',
  'tool look': 'reads',
  'tool guide': 'reads',
  'tool ask': 'a card to the person',
  'tool remember': 'a standing instruction, the person’s words',
  'tool rule': 'a rule for the gates, on the person’s yes',
  'tool run': 'starts a schedule, whose script is the schedule’s door',
  'plugin person': 'reads',
  'plugin rows': 'reads',
  'plugin catalogue': 'reads',
  'plugin people': 'reads',
  'plugin connectorTool': 'a connector’s tool, through the connector’s own gate',
  'plugin ask': 'one question to the model',
  'plugin explore': 'a question the model works out with read-only tools',
  'plugin own.rows': 'reads',
  'plugin route': 'a route of its own, whose writes are its host’s calls',
  'plugin startBlock': 'words at the start of a conversation',
  'plugin journal': 'a line of what the plugin did, never beside a change',
}

export function door(name: string): Door {
  const d = DOORS.find((x) => x.name === name)
  if (!d) throw new Error(`There is no door called ${name} in core/src/rules/doors.ts.`)
  return d
}
