// QuickBooks Online's Accounting API, read only. Every call here is a GET: Intuit has no read-only
// permission, so this file is the wall, and nothing in the connector sends anything else. Intuit's
// rules (developer.intuit.com, read 15 Nov 2026): minor version 75 or later; 500 calls a minute
// for each company, a 429 when that is passed, and a minute's wait after one; a test company is
// reached at the sandbox address, a real one at the production address.
import { type Call, Problem } from '@alpha/connector-sdk'

export const HOSTS = {
  production: 'https://quickbooks.api.intuit.com',
  sandbox: 'https://sandbox-quickbooks.api.intuit.com',
} as const
export type Where = keyof typeof HOSTS

const MINOR = '75'
const WAIT_MS = 60_000

interface Fault {
  Fault?: { Error?: { Message?: string; Detail?: string; code?: string }[]; type?: string }
}

// One read of the company's books: a path under /v3/company/<id>/, and its query.
export async function get<T>(
  c: Call,
  where: Where,
  path: string,
  query: Record<string, string> = {},
): Promise<T> {
  const token = await c.host.secret()
  if (!token) throw new Problem('Sign in with Intuit to finish connecting.', 'sign_in')
  const company = c.host.place
  if (!company) throw new Problem('Sign in with Intuit and pick the company.', 'sign_in')
  const u = new URL(`${HOSTS[where]}/v3/company/${encodeURIComponent(company)}/${path}`)
  for (const [k, v] of Object.entries({ ...query, minorversion: MINOR })) u.searchParams.set(k, v)
  const res = await fetch(u, {
    method: 'GET',
    headers: { authorization: `Bearer ${token}`, accept: 'application/json' },
    signal: AbortSignal.timeout(120_000),
  })
  if (res.ok) return (await res.json()) as T
  const body = (await res.json().catch(() => ({}))) as Fault
  const e = body.Fault?.Error?.[0]
  const said = [e?.Message, e?.Detail].filter(Boolean).join(': ') || `${res.status}`
  if (res.status === 401)
    throw new Problem(`Intuit no longer takes this sign-in: sign in again. (${said})`, 'sign_in')
  if (res.status === 429)
    throw new Problem(`Intuit asked Alpha to slow down: ${said}`, 'busy', {
      retryAfterMs: WAIT_MS,
    })
  if (res.status === 403)
    throw new Problem(`Intuit does not let Alpha read this company: ${said}`, 'blocked')
  throw new Problem(`QuickBooks said no: ${said}`)
}

// Where the company is: a real company at the production address, a test company at the sandbox
// one. Tried in that order: the first that answers is the company's, and is kept.
export async function whereIs(c: Call, known: Where | undefined): Promise<Where> {
  if (known) return known
  const company = c.host.place ?? ''
  let first: unknown
  for (const where of ['production', 'sandbox'] as const) {
    try {
      await get(c, where, `companyinfo/${encodeURIComponent(company)}`)
      return where
    } catch (err) {
      // a test company's sign-in is refused at the production address, and the other way round
      if (!(err instanceof Problem) || !['sign_in', 'blocked'].includes(err.kind)) throw err
      first ??= err
    }
  }
  throw first
}
