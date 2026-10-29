// What a connection may reach and what it was refused (step 2, part 1, slice 2), under it in
// Intelligence › Connections: its connector runs in its own sandbox, reaching only these hosts.
// A connector of sites the person chooses offers Allow beside a refusal (call 2).
import type { ConnectionView } from '@alpha/core/api'
import { api } from './api.ts'

const hostOf = (entry: string) => entry.replace(/:\d+$/, '')

const andList = (xs: string[]) =>
  xs.length < 2 ? (xs[0] ?? '') : `${xs.slice(0, -1).join(', ')} and ${xs.at(-1)}`

const day = (at: string) =>
  new Date(at).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    ...(new Date(at).getFullYear() !== new Date().getFullYear() ? { year: 'numeric' } : {}),
  })

export function Reach({
  connection: k,
  busy,
  act,
}: {
  connection: ConnectionView
  busy: boolean
  act: (fn: () => Promise<unknown>) => unknown
}) {
  const hosts = [...new Set(k.reaches.map(hostOf))]
  return (
    <>
      <span>
        In its own sandbox.{' '}
        {hosts.length ? `Reaches ${andList(hosts)}` : 'Reaches nothing outside Alpha'}
      </span>
      {k.refused.map((r) => (
        <span key={r.host} className="text-warn">
          Tried to reach {r.host}: refused, {day(r.at)}
          {k.canAllow && (
            <>
              {' · '}
              <button
                type="button"
                className="underline underline-offset-3"
                disabled={busy}
                onClick={() =>
                  act(() => api.post(`/api/connections/${k.id}/allow`, { host: r.host }))
                }
              >
                Allow
              </button>
            </>
          )}
        </span>
      ))}
    </>
  )
}
