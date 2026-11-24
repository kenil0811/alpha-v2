// A journey's steps on the account lines, pressed through the window's own routes as Your accounts
// and Settings › Connections call them: Disconnect on a line, which keeps it off, and Delete, which
// takes it away. And its check: the lines by address, and those off.
//   GET  /api/connect/accounts             { lines: [{ provider, account, state, connections }] }
//   POST /api/connections/:id/disconnect
//   POST /api/connect/accounts/delete      { provider, account }
import { z } from 'zod'
import type { AccountsView } from '../api/types.ts'
import { AS_WINDOW as HEADERS } from './headers.ts'
import type { StoryHere } from './story-steps.ts'

export const AccountPress = z.object({
  disconnect: z.string().optional(), // a line disconnected, by its address
  delete: z.string().optional(), // a line deleted, by its address
})

export const AccountChecks = [
  z.object({
    accounts: z.object({
      lines: z.array(z.string()).optional(), // every line's address, in order
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
  const address = step.disconnect ?? step.delete ?? ''
  const line = (await view(h))?.lines.find((l) => l.account === address)
  if (!line) return { ok: false, what: `**No account ${address} to press on.**` }
  const did = step.delete ? 'deleted' : 'disconnected'
  const posts = step.delete
    ? [
        {
          url: '/api/connect/accounts/delete',
          payload: { provider: line.provider, account: address },
        },
      ]
    : line.connections.map((k) => ({ url: `/api/connections/${k.id}/disconnect`, payload: {} }))
  for (const p of posts) {
    const res = await h.app().inject({ method: 'POST', headers: HEADERS, ...p })
    if (res.statusCode >= 400)
      return { ok: false, what: `**${address} could not be ${did} (${res.statusCode}).**` }
  }
  return { ok: true, what: `The owner ${did} ${address}` }
}

export async function accountCheck(
  check: unknown,
  h: StoryHere,
): Promise<{ check: string; ok: boolean; saw: string } | null> {
  const c = check as Record<string, unknown>
  if (!('accounts' in c)) return null
  const want = c.accounts as { lines?: string[]; off?: string[] }
  const v = await view(h)
  const lines = v?.lines.map((l) => l.account) ?? []
  const off = v?.lines.filter((l) => l.state === 'off').map((l) => l.account) ?? []
  const same = (a: string[] | undefined, b: string[]) =>
    !a || JSON.stringify(a) === JSON.stringify(b)
  return {
    check: `accounts ${JSON.stringify(want)}`,
    ok: !!v && same(want.lines, lines) && same(want.off, off),
    saw: `lines ${lines.join(', ') || 'none'}; off ${off.join(', ') || 'none'}`,
  }
}
