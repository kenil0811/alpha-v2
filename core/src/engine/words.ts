// What a step is called where the person reads it: plain words, no tool names, no ids. A
// connector's tools say their own words (its manifest); the desk asks the service first.
import { basename } from 'node:path'

type Input = Record<string, unknown>

const s = (v: unknown) => (typeof v === 'string' ? v : '')
const short = (v: string, n = 80) => (v.length > n ? `${v.slice(0, n - 1)}…` : v)

export function stepWords(tool: string, input: Input): string {
  const name = tool.replace(/^mcp__alpha__/, '')
  switch (name) {
    case 'query':
      return 'Looked through the tables'
    case 'search':
      return `Searched for “${short(s(input.words), 60)}”`
    case 'shape':
      switch (input.action) {
        case 'make_table':
          return `Made the table ${s(input.table)}`
        case 'add_fields':
          return `Added ${((input.fields as { name: string }[]) ?? []).map((f) => f.name).join(', ')} to ${s(input.table)}`
        case 'rename':
          return `Renamed ${s(input.field) || s(input.table)} to ${s(input.to)}`
        case 'set_choices':
          return `Set the choices for ${s(input.field)}`
        case 'remove_table':
          return `Remove the table ${s(input.table)}`
        case 'describe':
          return `Said what ${s(input.field) || s(input.table)} means`
        default:
          return `Changed the shape of ${s(input.table)}`
      }
    case 'write': {
      const n = Array.isArray(input.rows) ? input.rows.length : 0
      return `Added ${n === 1 ? 'a row' : `${n} rows`} to ${s(input.table)}`
    }
    case 'change': {
      const removing = Array.isArray(input.remove) ? input.remove.length : 0
      if (removing)
        return `Remove ${removing === 1 ? 'a row' : `${removing} rows`} from ${s(input.table)}`
      const n = Array.isArray(input.rows) ? input.rows.length : 0
      return `Changed ${n === 1 ? 'a row' : `${n} rows`} in ${s(input.table)}`
    }
    case 'file':
      return input.action === 'import'
        ? `Brought ${s(input.file)} into ${s(input.table)}`
        : `Read ${s(input.file)}`
    case 'ask':
      return input.answer_card
        ? 'Answered the card on your words'
        : `Asked: ${short(s(input.question))}`
    case 'task': {
      const title = typeof input.title === 'string' ? `: ${input.title}` : ''
      switch (input.action) {
        case 'add':
          return `Added a task${title}`
        case 'change':
          return 'Changed a task'
        case 'start':
          return 'Started a task'
        case 'wait':
          return 'Set a task waiting'
        case 'done':
          return 'Marked a task done'
        case 'drop':
          return 'Dropped a task'
        case 'reopen':
          return 'Opened a task again'
        case 'remove':
          return 'Removed tasks'
        default:
          return 'Looked at the tasks'
      }
    }
    case 'remember':
      return `Remembered: ${short(s(input.instruction))}`
    case 'Bash':
      return s(input.description) ? `Ran: ${short(s(input.description))}` : 'Ran a command'
    case 'Read':
      return `Read ${basename(s(input.file_path))}`
    case 'Write':
      return `Wrote ${basename(s(input.file_path))}`
    case 'Edit':
      return `Edited ${basename(s(input.file_path))}`
    case 'Glob':
    case 'Grep':
      return 'Looked through files'
    case 'WebSearch':
      return `Searched the web for “${short(s(input.query), 60)}”`
    case 'WebFetch': {
      const url = s(input.url)
      return `Read ${URL.canParse(url) ? new URL(url).host : 'a page'}`
    }
    case 'Agent':
      return `Started on it in the background: ${short(s(input.description))}`
    case 'ToolSearch':
      return 'Looked for the right connection'
    case 'network':
      return `Let a script reach ${s(input.host)}`
    case 'look': {
      const url = s(input.url)
      return `Looked at ${URL.canParse(url) ? new URL(url).host : 'a page'}`
    }
    case 'keep': {
      if (s(input.agent))
        return input.define
          ? `Kept the agent ${s(input.agent)}`
          : `Kept ${basename(s(input.path))} for ${s(input.agent)}`
      const [place, name] = s(input.path).split('/')
      const what =
        place === 'schedules'
          ? `the schedule ${(name ?? '').replace(/\.md$/, '')}`
          : place === 'skills'
            ? `the skill ${name ?? ''}`
            : place === 'pages'
              ? `the page ${name ?? ''}`
              : basename(s(input.path))
      return `Kept ${what} in ${s(input.module)}`
    }
    case 'memory':
      return input.action === 'search' ? 'Looked in its memory' : 'Noted something to remember'
    case 'run':
      return `Ran ${s(input.schedule) || basename(s(input.script))} to try it`
    case 'connect':
      return `Connect ${s(input.connector)}`
    default:
      return 'Worked on it'
  }
}
