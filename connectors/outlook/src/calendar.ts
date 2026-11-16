// Outlook's calendar and contacts through Microsoft Graph, read only, into the Events and Contacts
// every calendar and address book shares (connector-sdk/src/shared-tables.ts): the events 90 days
// back and 60 ahead, each occurrence of a repeating one its own row, and the person's contacts.
import { type Item, who } from '@alpha/connector-sdk'

const DAY = 86_400_000

// One Graph GET as the person, as index.ts asks it: a path under v1.0, or Graph's own next address.
export type Get = <T>(path: string, prefer?: string[]) => Promise<T>

interface Page<T> {
  value: T[]
  '@odata.nextLink'?: string
}

interface Person {
  emailAddress?: { name?: string; address?: string }
}

interface GraphEvent {
  id: string
  subject?: string
  start?: { dateTime?: string }
  end?: { dateTime?: string }
  isAllDay?: boolean
  location?: { displayName?: string }
  attendees?: Person[]
  organizer?: Person
  calendar?: { name?: string }
}

interface GraphContact {
  id: string
  displayName?: string
  givenName?: string
  surname?: string
  companyName?: string
  jobTitle?: string
  emailAddresses?: { address?: string }[]
  businessPhones?: string[]
  mobilePhone?: string | null
  homePhones?: string[]
}

async function all<T>(get: Get, path: string, prefer?: string[]): Promise<T[]> {
  const out: T[] = []
  let next: string | undefined = path
  while (next) {
    const page: Page<T> = await get<Page<T>>(next, prefer)
    out.push(...page.value)
    next = page['@odata.nextLink']
  }
  return out
}

// Graph gives times in UTC when asked (Prefer: outlook.timezone="UTC"), without the Z.
const utc = (t: string | undefined) => (t ? new Date(t.endsWith('Z') ? t : `${t}Z`) : new Date())
const person = (p: Person | undefined) => ({
  name: p?.emailAddress?.name,
  email: p?.emailAddress?.address,
})

export async function events(get: Get, account: string, now = Date.now()): Promise<Item[]> {
  const from = new Date(now - 90 * DAY).toISOString()
  const to = new Date(now + 60 * DAY).toISOString()
  const list = await all<GraphEvent>(
    get,
    `/me/calendarView?startDateTime=${from}&endDateTime=${to}&$top=200&$select=id,subject,start,end,isAllDay,location,attendees,organizer`,
    ['outlook.timezone="UTC"'],
  )
  const me = account.toLowerCase()
  return list.map((e) => {
    const people = [...(e.attendees ?? []), ...(e.organizer ? [e.organizer] : [])].map(person)
    return {
      key: e.id,
      values: {
        Title: e.subject ?? '',
        Starts: utc(e.start?.dateTime).toISOString(),
        Ends: utc(e.end?.dateTime).toISOString(),
        'All day': e.isAllDay ? 'yes' : 'no',
        Location: e.location?.displayName ?? '',
        Calendar: 'Outlook',
        Attendees: (e.attendees ?? []).map((a) => who(person(a))).join(', '),
        Organizer: e.organizer ? who(person(e.organizer)) : '',
        'Your address': people.some((p) => p.email?.toLowerCase() === me) ? account : '',
      },
    }
  })
}

export async function contacts(get: Get): Promise<Item[]> {
  const list = await all<GraphContact>(
    get,
    '/me/contacts?$top=200&$select=id,displayName,givenName,surname,companyName,jobTitle,emailAddresses,businessPhones,mobilePhone,homePhones',
  )
  return list.map((p) => ({
    key: p.id,
    values: {
      Name:
        p.displayName ||
        [p.givenName, p.surname].filter(Boolean).join(' ') ||
        (p.companyName ?? ''),
      Company: p.companyName ?? '',
      Emails: (p.emailAddresses ?? [])
        .map((e) => e.address ?? '')
        .filter(Boolean)
        .join(', '),
      Phones: [
        ...(p.businessPhones ?? []),
        ...(p.mobilePhone ? [p.mobilePhone] : []),
        ...(p.homePhones ?? []),
      ].join(', '),
      Title: p.jobTitle ?? '',
      Profile: '',
      'Is you': 'no',
    },
  }))
}
