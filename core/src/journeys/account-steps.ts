// A journey's steps on the account lines (Vikas, 23 Nov), pressed through the window's own routes
// as Connect and Settings › Connections call them: Delete on a line, which keeps it under
// Excluded, and Restore from Excluded, which brings it back disconnected. And its check: the lines
// and Excluded, by address.
//   GET  /api/connect/accounts           { lines: [{ provider, account, state }], excluded: [...] }
//   POST /api/connect/accounts/delete    { provider, account }
//   POST /api/connect/excluded/restore   { kind: 'account', provider, name }
import { z } from 'zod'
import type { AccountsView } from '../api/types.ts'
import { AS_WINDOW as HEADERS } from './headers.ts'
import type { StoryHere } from './story-steps.ts'

export const AccountPress = z.object({
  delete: z.string().optional(), // a line deleted, by its address
  restore: z.string().optional(), // an account restored from Excluded, by its address
})

export const AccountChecks = [
  z.object({
    accounts: z.object({
      lines: z.array(z.string()).optional(), // every line's address, in order
      excluded: z.array(z.string()).optional(), // what Excluded holds, by address or name
      off: z.array(z.string()).optional(), // the lines disconnected, by address
    }),
  }),
] as const

const view = async (h: StoryHere): Promise<AccountsView | null> => {
  const res = await h.app().inject({ url: '/api/connect/accounts', headers: HEADERS })
  return res.statusCode < 400 ? (res.json() as AccountsView) : null
}

export async function accountStep(
  step: z.infer<typeof AccountPress>,
  h: StoryHere,
): Promise<{ ok: boolean; what: string }> {
  const v = await view(h)
  const address = step.delete ?? step.restore ?? ''
  const provider = step.delete
    ? v?.lines.find((l) => l.account === address)?.provider
    : v?.excluded.find((x) => x.name === address)?.provider
  if (!provider) return { ok: false, what: `**No account ${address} to press on.**` }
  const res = await h.app().inject({
    method: 'POST',
    url: step.delete ? '/api/connect/accounts/delete' : '/api/connect/excluded/restore',
    headers: HEADERS,
    payload: step.delete
      ? { provider, account: address }
      : { kind: 'account', provider, name: address },
  })
  const did = step.delete ? 'deleted' : 'restored'
  return res.statusCode < 400
    ? { ok: true, what: `The owner ${did} ${address}` }
    : { ok: false, what: `**${address} could not be ${did} (${res.statusCode}).**` }
}

export async function accountCheck(
  check: unknown,
  h: StoryHere,
): Promise<{ check: string; ok: boolean; saw: string } | null> {
  const c = check as Record<string, unknown>
  if (!('accounts' in c)) return null
  const want = c.accounts as { lines?: string[]; excluded?: string[]; off?: string[] }
  const v = await view(h)
  const lines = v?.lines.map((l) => l.account) ?? []
  const excluded = v?.excluded.map((x) => x.name) ?? []
  const off = v?.lines.filter((l) => l.state === 'off').map((l) => l.account) ?? []
  const same = (a: string[] | undefined, b: string[]) =>
    !a || JSON.stringify(a) === JSON.stringify(b)
  return {
    check: `accounts ${JSON.stringify(want)}`,
    ok: !!v && same(want.lines, lines) && same(want.excluded, excluded) && same(want.off, off),
    saw: `lines ${lines.join(', ') || 'none'}; excluded ${excluded.join(', ') || 'none'}; off ${off.join(', ') || 'none'}`,
  }
}
