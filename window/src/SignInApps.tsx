// Sign-in apps: the organisation's own app for signing in with a provider (Microsoft, Intuit), set
// up once by its IT from the setup sheet shown here, before anyone signs in with it; and a person's
// sign-in itself, on the provider's own page in their browser. An app's secret (Intuit's) is typed
// once and kept by Alpha: the field shows it is kept, never what it is.
import type { SignInAppView } from '@alpha/core/api'
import { Check, Copy, KeyRound } from 'lucide-react'
import { type FormEvent, useState } from 'react'
import { api } from './api.ts'
import { Refusal, useAct } from './ui/act.tsx'
import { Button } from './ui/button.tsx'
import { Field, SecretField } from './ui/field.tsx'
import { Frame } from './ui/frame.tsx'
import { Tile } from './ui/list.tsx'
import { Pill } from './ui/pill.tsx'
import { Section } from './ui/section.tsx'

// A connection's sign-in: the provider's page opens in the person's browser (the core opens it on
// this Mac; else the window does).
export async function signInWith(connection: string): Promise<void> {
  const out = await api.post<{ url: string; opened: boolean }>(
    `/api/connections/${connection}/sign-in`,
  )
  if (!out.opened) window.open(out.url, '_blank', 'noreferrer')
}

export function SignInApps({ apps, onChange }: { apps: SignInAppView[]; onChange: () => void }) {
  if (!apps.length) return null
  return (
    <Section
      title="Sign-in apps"
      about="Your organisation’s own app for signing in: your IT sets it up once, then each person signs in with their own account, and Alpha reaches only what they can."
    >
      <div className="grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-3">
        {apps.map((a) => (
          <AppTile key={a.provider} app={a} onChange={onChange} />
        ))}
      </div>
    </Section>
  )
}

function AppTile({ app: a, onChange }: { app: SignInAppView; onChange: () => void }) {
  const [open, setOpen] = useState(false)
  return (
    <Frame className="flex flex-col gap-3 has-[form]:col-span-full">
      <div className="flex items-center gap-3">
        <Tile>
          <KeyRound className="size-4" />
        </Tile>
        <div className="min-w-0 flex-1">
          <div className="truncate font-medium text-base text-ink">{a.title}</div>
          <div className="text-ink-3 text-sm">
            {a.set ? 'Set up for your organisation' : 'Your IT sets it up once'}
          </div>
        </div>
        <Pill tone={a.set ? 'good' : 'warn'}>{a.set ? 'Set up' : 'Not set up'}</Pill>
        {!open && (
          <Button size="sm" variant={a.set ? 'ghost' : 'default'} onClick={() => setOpen(true)}>
            {a.set ? 'Change' : 'Set up'}
          </Button>
        )}
      </div>
      {open && (
        <AppSetup
          app={a}
          onSaved={() => {
            setOpen(false)
            onChange()
          }}
          onCancel={() => setOpen(false)}
        />
      )}
    </Frame>
  )
}

// A sign-in app's setup sheet and the boxes for what the provider gives back: in Settings, and in
// place on a connector's tile in Set up Alpha.
export function AppSetup({
  app: a,
  onSaved,
  onCancel,
}: {
  app: SignInAppView
  onSaved: () => void
  onCancel: () => void
}) {
  const [id, setId] = useState(a.set?.app ?? '')
  const [directory, setDirectory] = useState(a.set?.directory ?? '')
  const [secret, setSecret] = useState('')
  const { busy, problem, act } = useAct()
  const save = async (e: FormEvent) => {
    e.preventDefault()
    const ok = await act(() =>
      api.post(`/api/sign-in-apps/${a.provider}`, {
        app: id,
        ...(a.fields.directory ? { directory } : {}),
        ...(a.fields.secret && secret ? { secret } : {}),
      }),
    )
    if (ok) {
      setSecret('')
      onSaved()
    }
  }
  // a secret is needed the first time; after that, an empty field keeps the one kept
  const ready =
    !!id.trim() &&
    (!a.fields.directory || !!directory.trim()) &&
    (!a.fields.secret || !!a.set?.secret || !!secret.trim())
  return (
    <form onSubmit={save} className="flex flex-col gap-4">
      <ol className="flex flex-col gap-3">
        {a.sheet.map((s, i) => (
          <li key={s.words} className="flex gap-3 text-md">
            <span className="grid size-5 shrink-0 place-items-center rounded-full bg-accent-soft text-accent text-xs">
              {i + 1}
            </span>
            <div className="flex min-w-0 flex-col gap-1.5">
              <span className="text-ink-2">{s.words}</span>
              {s.copy && (
                <span className="flex flex-wrap gap-1.5">
                  {s.copy.map((v) => (
                    <CopyChip key={v} value={v} />
                  ))}
                </span>
              )}
            </div>
          </li>
        ))}
      </ol>
      <div className="grid grid-cols-2 gap-3 max-md:grid-cols-1">
        <label className="flex flex-col gap-1 text-md" htmlFor={`${a.provider}-app`}>
          <span className="text-ink-2">{a.fields.app.label}</span>
          <Field
            id={`${a.provider}-app`}
            value={id}
            placeholder={a.fields.app.example}
            onChange={(e) => setId(e.target.value)}
            autoComplete="off"
            spellCheck={false}
          />
        </label>
        {a.fields.directory && (
          <label className="flex flex-col gap-1 text-md" htmlFor={`${a.provider}-directory`}>
            <span className="text-ink-2">{a.fields.directory.label}</span>
            <Field
              id={`${a.provider}-directory`}
              value={directory}
              placeholder={a.fields.directory.example}
              onChange={(e) => setDirectory(e.target.value)}
              autoComplete="off"
              spellCheck={false}
            />
          </label>
        )}
        {a.fields.secret && (
          <label className="flex flex-col gap-1 text-md" htmlFor={`${a.provider}-secret`}>
            <span className="text-ink-2">{a.fields.secret.label}</span>
            <SecretField
              id={`${a.provider}-secret`}
              value={secret}
              placeholder={a.set?.secret ? 'Kept. Type a new one to replace it' : ''}
              onChange={(e) => setSecret(e.target.value)}
            />
          </label>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Button type="submit" size="sm" variant="primary" disabled={busy || !ready}>
          {busy ? 'Saving…' : 'Save'}
        </Button>
        <Button size="sm" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
        <Refusal words={problem} />
      </div>
    </form>
  )
}

// A value IT types exactly (an address, a permission's name), copied with one click.
function CopyChip({ value }: { value: string }) {
  const [done, setDone] = useState(false)
  return (
    <button
      type="button"
      aria-label={`Copy ${value}`}
      onClick={() => {
        void navigator.clipboard?.writeText(value)
        setDone(true)
        setTimeout(() => setDone(false), 1200)
      }}
      className="inline-flex max-w-full items-center gap-1.5 rounded-md border border-line bg-sunk px-2 py-0.5 font-mono text-ink text-sm hover:bg-hover"
    >
      <span className="truncate">{value}</span>
      {done ? (
        <Check className="size-3 shrink-0 text-good" />
      ) : (
        <Copy className="size-3 shrink-0 text-ink-3" />
      )}
    </button>
  )
}
