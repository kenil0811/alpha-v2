// Every account a person reads, one line each, and one Add for as many as they wish (Vikas,
// 23 Nov): in Set up Alpha's Connect and in Settings › Connections alike. A line is its address, a
// green dot once connected, "Reading now…" while its first read runs, then what landed; the rest
// is in its ⓘ. Under the pointer (always, on a touch screen) Disconnect and Delete, or Reconnect
// and Delete for one that is off or asks something. Deleted accounts and apps left out wait under
// Excluded, at the foot, to be restored.
import type {
  AccountLine,
  AccountsView,
  ConnectorsView,
  ConnectorView,
  ExcludedView,
} from '@alpha/core/api'
import { Check, ChevronRight, ExternalLink, Plus } from 'lucide-react'
import { type ReactNode, useCallback, useEffect, useState } from 'react'
import { api } from './api.ts'
import { ConnectForm } from './Connections.tsx'
import { AppSetup, signInWith } from './SignInApps.tsx'
import { Refusal, useAct } from './ui/act.tsx'
import { Button } from './ui/button.tsx'
import { cn } from './ui/cn.ts'
import { CodeLine } from './ui/code-line.tsx'
import { Info } from './ui/info.tsx'
import { Segmented } from './ui/segmented.tsx'

// The lines and Excluded, loaded and counted again while they are shown.
export function useAccounts(mine: boolean): { view: AccountsView | null; load: () => void } {
  const [view, setView] = useState<AccountsView | null>(null)
  const load = useCallback(() => {
    api
      .get<AccountsView>(`/api/connect/accounts${mine ? '?mine=1' : ''}`)
      .then(setView, () => undefined)
  }, [mine])
  useEffect(() => {
    load()
    const t = setInterval(load, 5000)
    return () => clearInterval(t)
  }, [load])
  return { view, load }
}

// What shows under the pointer on a line, and always where there is no pointer to hover with.
const ON_HOVER =
  'opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 [@media(hover:none)]:opacity-100'

export function AccountList({
  view,
  connectors,
  onChange,
}: {
  view: AccountsView
  connectors: ConnectorsView | null
  onChange: () => void
}) {
  const [adding, setAdding] = useState(false)
  return (
    <div className="flex flex-col">
      {view.lines.length > 0 && (
        <ul className="flex flex-col">
          {view.lines.map((l) => (
            <Line key={l.key} line={l} view={view} connectors={connectors} onChange={onChange} />
          ))}
        </ul>
      )}
      {adding ? (
        <Add
          view={view}
          connectors={connectors}
          onDone={() => {
            setAdding(false)
            onChange()
          }}
        />
      ) : (
        <div className={cn('flex', view.lines.length > 0 && 'border-hair border-t pt-2')}>
          <Button size="sm" onClick={() => setAdding(true)}>
            <Plus className="size-3.5" />
            Add
          </Button>
        </div>
      )}
    </div>
  )
}

const DOT: Record<AccountLine['state'], string> = {
  connected: 'bg-good',
  reading: 'bg-good animate-pulse motion-reduce:animate-none',
  off: 'bg-ink-4',
  failed: 'bg-warn',
}

function Line({
  line: l,
  view,
  connectors,
  onChange,
}: {
  line: AccountLine
  view: AccountsView
  connectors: ConnectorsView | null
  onChange: () => void
}) {
  const { busy, problem, act } = useAct(onChange)
  // a form opened on the line: a password to give again, or Google mail or calendar to add
  const [form, setForm] = useState<{ connector: string; steps: boolean } | null>(null)
  const c = form ? connectors?.connectors.find((x) => x.name === form.connector) : undefined
  const app = (x: ConnectorView | undefined) =>
    x?.signsInWith
      ? !!connectors?.signInApps.find((a) => a.provider === x.signsInWith?.provider)?.set
      : null
  const on = l.state === 'connected' || l.state === 'reading'
  const reconnect = () => {
    const k = l.connections.find((x) => x.state !== 'connected') ?? l.connections[0]
    if (!k) return
    if (k.auth === 'oauth') void act(() => signInWith(k.id))
    else setForm({ connector: k.connector, steps: k.connector === 'gmail' })
  }
  const help = [
    `${l.title}: ${l.reads.join(', ')}.`,
    l.by !== 'You' ? `Connected by ${l.by}, for everyone.` : null,
    l.problem,
  ]
    .filter(Boolean)
    .join('\n')
  return (
    <li className="group flex flex-col gap-2 border-hair border-t py-1.5 first:border-t-0">
      <div className="flex min-h-7 flex-wrap items-center gap-x-2 gap-y-1 text-md">
        <span className={cn('size-2 shrink-0 rounded-full', DOT[l.state])} aria-hidden />
        <span className="min-w-0 truncate text-ink">{l.account}</span>
        <Info help={help} />
        <span className="flex min-w-0 flex-1 items-center gap-1 truncate text-ink-3 text-sm">
          {l.state === 'reading' ? (
            'Reading now…'
          ) : l.state === 'connected' ? (
            <>
              <Check className="size-3 shrink-0 text-good" />
              {l.landed.join(' · ')}
            </>
          ) : l.state === 'off' ? (
            'Disconnected'
          ) : (
            <span className="text-warn">Needs you</span>
          )}
        </span>
        <span className={cn('flex shrink-0 items-center gap-1', !form && ON_HOVER)}>
          {on &&
            l.adds.map((a) => (
              <Button
                key={a}
                size="sm"
                variant="ghost"
                onClick={() =>
                  a === 'mail'
                    ? setForm({ connector: 'gmail', steps: true })
                    : setForm({ connector: 'google', steps: false })
                }
              >
                {a === 'mail' ? 'Add mail' : 'Add calendar'}
              </Button>
            ))}
          {on ? (
            <Button
              size="sm"
              variant="ghost"
              disabled={busy}
              onClick={() =>
                void act(async () => {
                  for (const k of l.connections)
                    await api.post(`/api/connections/${k.id}/disconnect`)
                })
              }
            >
              Disconnect
            </Button>
          ) : (
            <Button size="sm" variant="ghost" disabled={busy} onClick={reconnect}>
              Reconnect
            </Button>
          )}
          <Button
            size="sm"
            variant="ghost"
            disabled={busy}
            onClick={() =>
              void act(() =>
                api.post('/api/connect/accounts/delete', {
                  provider: l.provider,
                  account: l.account,
                }),
              )
            }
          >
            Delete
          </Button>
        </span>
      </div>
      <Refusal words={problem} />
      {form && c && (
        <div className="flex flex-col gap-3 pb-2 pl-4">
          {form.steps && <Steps steps={view.appPassword} />}
          <ConnectForm
            connector={c}
            appSet={app(c)}
            account={l.account}
            onDone={() => {
              setForm(null)
              onChange()
            }}
            onCancel={() => setForm(null)}
          />
        </div>
      )}
    </li>
  )
}

type Provider = 'google' | 'microsoft' | 'other'

// Add: which provider, business or personal (a business may need its admin's approval for
// Microsoft), and that provider's one sign-in; where Alpha's own app is not registered and the
// firm has none set up, the setup sheet as before.
function Add({
  view,
  connectors,
  onDone,
}: {
  view: AccountsView
  connectors: ConnectorsView | null
  onDone: () => void
}) {
  const [provider, setProvider] = useState<Provider>(view.google.loaded ? 'google' : 'microsoft')
  const [kind, setKind] = useState<'business' | 'personal'>('business')
  const [other, setOther] = useState<string | null>(view.other[0] ?? null)
  const [settingUp, setSettingUp] = useState(false)
  const find = (name: string) => connectors?.connectors.find((c) => c.name === name)
  const appOf = (p: string) => connectors?.signInApps.find((a) => a.provider === p)
  const faint = (words: string) => <p className="text-ink-3 text-md">{words}</p>
  const form = (name: string, appSet: boolean | null) => {
    const c = find(name)
    return c ? (
      <ConnectForm connector={c} appSet={appSet} onDone={onDone} onCancel={onDone} />
    ) : null
  }
  const setup = (p: 'google' | 'microsoft') => {
    const a = appOf(p)
    return a ? (
      <AppSetup app={a} onSaved={() => setSettingUp(false)} onCancel={() => setSettingUp(false)} />
    ) : null
  }

  let body: ReactNode = null
  if (provider === 'google') {
    if (!view.google.loaded) body = faint('Google does not come with this Alpha.')
    else if (view.google.ready)
      body = (
        <>
          {form('google', true)}
          {view.google.mail &&
            faint('Mail comes with an app password, added on the account’s line once it is in.')}
        </>
      )
    else if (settingUp) body = setup('google')
    else
      body = (
        <>
          <Steps steps={view.appPassword} />
          {form('gmail', null)}
          {find('google') &&
            (view.owner ? (
              <Button
                size="sm"
                variant="ghost"
                className="self-start"
                onClick={() => setSettingUp(true)}
              >
                Calendar and contacts too: set up Google sign-in
              </Button>
            ) : (
              faint(`Calendar and contacts wait on ${view.ownerName} to set up Google sign-in.`)
            ))}
        </>
      )
  } else if (provider === 'microsoft') {
    if (!view.microsoft.loaded) body = faint('Microsoft does not come with this Alpha.')
    else if (view.microsoft.ready)
      body = (
        <>
          {kind === 'business' && view.microsoft.consent && (
            <div className="flex flex-col gap-1.5">
              <p className="text-ink-2 text-md">
                If your organisation asks for an admin’s approval, send them this link. They approve
                Alpha once, for everyone there.
              </p>
              <CodeLine text={view.microsoft.consent} />
            </div>
          )}
          {form('outlook', true)}
        </>
      )
    else if (view.owner) body = setup('microsoft')
    else body = faint(`Waits on ${view.ownerName} to set up Microsoft sign-in.`)
  } else if (!view.other.length) body = faint('No other mail Alpha reads yet.')
  else
    body = (
      <>
        {view.other.length > 1 && (
          <Segmented
            label="Which mail"
            value={other ?? ''}
            options={view.other.map((n) => ({ value: n, label: find(n)?.title ?? n }))}
            onChange={setOther}
          />
        )}
        {other && form(other, appOf(find(other)?.signsInWith?.provider ?? '')?.set ? true : null)}
      </>
    )

  return (
    <div className="flex flex-col gap-3 border-hair border-t pt-3">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <Segmented
          label="Which account"
          value={provider}
          options={[
            { value: 'google', label: 'Google' },
            { value: 'microsoft', label: 'Microsoft' },
            { value: 'other', label: 'Other mail' },
          ]}
          onChange={(p) => {
            setProvider(p)
            setSettingUp(false)
          }}
        />
        <span className="flex items-center gap-2 text-ink-3 text-sm">
          This account is
          <Segmented
            label="This account is"
            value={kind}
            options={[
              { value: 'business', label: 'Business' },
              { value: 'personal', label: 'Personal' },
            ]}
            onChange={setKind}
          />
        </span>
      </div>
      {body}
      <Button size="sm" variant="ghost" className="self-start" onClick={onDone}>
        Close
      </Button>
    </div>
  )
}

export function Steps({ steps }: { steps: AccountsView['appPassword'] }) {
  return (
    <ol className="flex flex-col gap-2.5">
      {steps.map((s, i) => (
        <li key={s.words} className="flex gap-3 text-md">
          <span className="grid size-5 shrink-0 place-items-center rounded-full bg-accent-soft text-accent text-xs">
            {i + 1}
          </span>
          <span className="flex min-w-0 flex-1 flex-col gap-1.5 text-ink-2">
            {s.words}
            {s.url && (
              <span className="flex min-w-0 items-center gap-2">
                <CodeLine text={s.url} className="min-w-0 flex-1" />
                <a
                  href={s.url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex shrink-0 items-center gap-1 text-accent text-sm underline underline-offset-3"
                >
                  Open <ExternalLink className="size-3" />
                </a>
              </span>
            )}
          </span>
        </li>
      ))}
    </ol>
  )
}

// Excluded, at the foot: what the person deleted or left out, folded with its count, each with
// Restore. An account comes back disconnected, ready to sign in again.
export function Excluded({ items, onChange }: { items: ExcludedView[]; onChange: () => void }) {
  const { busy, problem, act } = useAct(onChange)
  if (!items.length) return null
  return (
    <details className="group/x flex flex-col">
      <summary className="flex cursor-pointer list-none items-center gap-1.5 py-1 text-ink-3 text-sm hover:text-ink [&::-webkit-details-marker]:hidden">
        <ChevronRight className="size-3.5 transition-transform group-open/x:rotate-90" />
        Excluded · {items.length}
      </summary>
      <ul className="flex flex-col pl-5">
        {items.map((x) => (
          <li
            key={`${x.kind}:${x.provider}:${x.name}`}
            className="flex items-center gap-2 border-hair border-t py-1.5 text-md first:border-t-0"
          >
            <span className="min-w-0 truncate text-ink-2">{x.name}</span>
            <span className="flex-1 text-ink-3 text-sm">{x.title}</span>
            <Button
              size="sm"
              variant="ghost"
              disabled={busy}
              onClick={() =>
                void act(() =>
                  api.post('/api/connect/excluded/restore', {
                    kind: x.kind,
                    provider: x.provider,
                    name: x.name,
                  }),
                )
              }
            >
              Restore
            </Button>
          </li>
        ))}
      </ul>
      <Refusal words={problem} />
    </details>
  )
}
