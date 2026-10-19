// What a step is called where the person reads it: plain words, no tool names, no ids.
import { basename } from 'node:path'

type Input = Record<string, unknown>

const s = (v: unknown) => (typeof v === 'string' ? v : '')
const short = (v: string, n = 80) => (v.length > n ? `${v.slice(0, n - 1)}…` : v)

export function stepWords(tool: string, input: Input): string {
  const name = tool.replace(/^mcp__(alpha|connectors)__/, '')
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
    case 'connect':
      return `Connect ${s(input.connector)}`
    case 'gmail_search':
      return `Searched Gmail for “${short(s(input.query), 60)}”`
    case 'gmail_read':
      return 'Read an email'
    case 'gmail_draft':
      return `Saved a draft to ${s(input.to)}`
    case 'gmail_send':
      return `Send an email to ${s(input.to)}`
    case 'calendar_events':
      return 'Looked at the calendar'
    case 'contacts_find':
      return `Looked up “${short(s(input.words), 40)}” in contacts`
    default:
      return 'Worked on it'
  }
}
