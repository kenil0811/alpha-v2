// Rows kept outside a module's tables (people, organizations, tasks), drawn by the one shared table
// view all the same: each list turned into a table's shape, read only. Fields' ids are their slugs.
import type {
  FieldView,
  PersonLineView,
  RowView,
  TableView as TableData,
  TaskLineView,
} from '@alpha/core/api'

const field = (name: string, kind: string, tones: FieldView['tones'] = {}): FieldView => ({
  id: name.toLowerCase(),
  name,
  slug: name.toLowerCase(),
  kind,
  choices: Object.keys(tones),
  tones,
  many: false,
  about: null,
  aboutBy: null,
})

const table = (
  id: string,
  name: string,
  fields: FieldView[],
  rows: { id: string; values: Record<string, unknown> }[],
): TableData => ({
  id,
  name,
  about: null,
  aboutBy: null,
  module: { id: '', name: '' },
  fields,
  documents: null,
  rows: rows.map((r): RowView => ({ ...r, sources: {} })),
  names: {},
  views: [],
})

export function peopleTable(lines: PersonLineView[], kind: 'person' | 'company'): TableData {
  if (kind === 'company')
    return table(
      'kept-companies',
      'Organizations',
      [field('Name', 'text'), field('Domain', 'text'), field('People', 'number')],
      lines.map((p) => ({
        id: p.id,
        values: { name: p.name, domain: p.domains.join(', '), people: p.people },
      })),
    )
  return table(
    'kept-people',
    'People',
    [
      field('Name', 'text'),
      field('Organization', 'text'),
      field('Email', 'email'),
      field('Phone', 'phone'),
      field('Last', 'date'),
      field('Talks', 'number'),
    ],
    lines.map((p) => ({
      id: p.id,
      values: {
        name: p.name,
        organization: p.companies.join(', '),
        email: p.emails[0] ?? null,
        phone: p.phones[0] ?? null,
        last: p.last,
        talks: p.count,
      },
    })),
  )
}

const STATE: Record<TaskLineView['state'], string> = {
  todo: 'To do',
  doing: 'Doing',
  waiting: 'Waiting',
  done: 'Done',
  dropped: 'Dropped',
}

export function tasksTable(lines: TaskLineView[]): TableData {
  return table(
    'kept-tasks',
    'Tasks',
    [
      field('Task', 'text'),
      field('State', 'choice', {
        'To do': 'accent',
        Doing: 'accent',
        Waiting: 'warn',
        Done: 'good',
        Dropped: 'bad',
      }),
      field('Due', 'date'),
      field('Priority', 'choice', { High: 'bad', Normal: 'accent', Low: 'good' }),
      field('Owner', 'text'),
      field('Where', 'text'),
    ],
    lines.map((t) => ({
      id: t.id,
      values: {
        task: t.title,
        state: STATE[t.state],
        due: t.due,
        priority: t.priority[0]?.toUpperCase() + t.priority.slice(1),
        owner: t.owner,
        where: t.place.words,
      },
    })),
  )
}
