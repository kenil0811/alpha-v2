// A computer's own page, opened from its row under Your computers: how it stands, what it lends
// (its folders, its Calendar and Contacts, each as Connections shows a connection), Lend a folder,
// and its latest reads. This Mac, on the Mac app, holds the folders added by their path instead.
import type { ComputerPageView, ConnectorsView, ConnectorView } from '@alpha/core/api'
import { Trash2 } from 'lucide-react'
import { type FormEvent, useCallback, useEffect, useState } from 'react'
import { api, Problem, wordsOf } from './api.ts'
import { computerState } from './Computers.tsx'
import { ConnectionLine } from './ConnectionLine.tsx'
import { Record } from './Record.tsx'
import { Refusal, useAct } from './ui/act.tsx'
import { Button } from './ui/button.tsx'
import { Confirm } from './ui/dialog.tsx'
import { Field } from './ui/field.tsx'
import { List, Row } from './ui/list.tsx'
import { Pill } from './ui/pill.tsx'
import { Empty, Section } from './ui/section.tsx'
import { updatedWords } from './ui/update-now.tsx'

const added = (at: string) =>
  new Date(at).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })

export function ComputerPage({
  id,
  version,
  onName,
}: {
  id: string
  version: number
  onName: (name: string) => void
}) {
  const [view, setView] = useState<ComputerPageView | null>(null)
  const [failed, setFailed] = useState<string | null>(null)
  // the connectors that add a folder here by its path (This Mac only)
  const [places, setPlaces] = useState<ConnectorView[]>([])
  const load = useCallback(() => {
    void api.get<ComputerPageView>(`/api/computers/${id}`).then(
      (v) => {
        setView(v)
        onName(v.computer.name)
      },
      (e) => setFailed(wordsOf(e)),
    )
  }, [id, onName])
  // read again whenever the world changes (a read, a folder lent, the computer coming or going)
  useEffect(() => {
    if (version >= 0) load()
  }, [load, version])
  const here = view?.computer.here ?? false
  useEffect(() => {
    if (!here) return
    void api
      .get<ConnectorsView>('/api/connectors')
      .then((v) => setPlaces(v.connectors.filter((c) => c.auth === 'path' && !c.onComputer)))
  }, [here])
  const { busy, problem, act } = useAct(load)
  const [asked, setAsked] = useState(false)
  const [leaving, setLeaving] = useState(false)
  // the picker's line goes once what it lends changes
  const count = view?.lends.length ?? 0
  useEffect(() => {
    if (count >= 0) setAsked(false)
  }, [count])
  if (!view) return failed ? <Refusal words={failed} /> : null
  const c = view.computer
  const [state, tone] = computerState(c)
  const about = c.here
    ? 'Alpha runs on this computer: a folder is added here by its path.'
    : [
        c.online
          ? 'Connected now'
          : c.lastSeenAt
            ? `Last seen ${updatedWords(c.lastSeenAt)}`
            : null,
        c.version ? `Alpha Bridge ${c.version}` : null,
        c.pairedAt ? `Added ${added(c.pairedAt)}` : null,
      ]
        .filter(Boolean)
        .join(' · ')
  return (
    <Record kind="Your computer">
      <h1 className="font-serif text-2xl text-ink">{c.name}</h1>
      <div className="-mt-3 flex flex-wrap items-center gap-2">
        {!c.here && <Pill tone={tone}>{state}</Pill>}
        <span className="text-ink-3 text-sm">{about}</span>
        <span className="flex-1" />
        {!c.here && c.online && (
          <Button
            size="sm"
            disabled={busy}
            onClick={() =>
              act(async () => {
                await api.post(`/api/computers/${c.id}/pick`)
                setAsked(true)
              })
            }
          >
            Lend a folder
          </Button>
        )}
        {!c.here && (
          <Button size="sm" variant="ghost" disabled={busy} onClick={() => setLeaving(true)}>
            <Trash2 className="size-3.5" />
            Delete
          </Button>
        )}
      </div>
      <Refusal words={problem} />
      {asked && (
        <p className="text-ink-2 text-md">Pick the folder on {c.name}: its picker is open there.</p>
      )}
      <Section
        title="What it lends"
        about={
          c.here
            ? 'Folders Alpha reads on this computer: what you put in one is kept and read, as if you dropped it in. Alpha never writes to them.'
            : `What ${c.name} lends Alpha through Alpha Bridge: folders, picked there, and its Calendar and Contacts, turned on in Alpha Bridge's menu there. Alpha reads them only while it is on and not paused, and never writes to them.`
        }
      >
        {view.lends.length > 0 ? (
          <List>
            {view.lends.map((k) => (
              <ConnectionLine key={k.id} connection={k} onChange={load} />
            ))}
          </List>
        ) : (
          <Empty>
            {c.here
              ? 'No folders added yet.'
              : `Nothing lent yet. Lend a folder here, or turn on Calendar or Contacts in Alpha Bridge's menu on ${c.name}.`}
          </Empty>
        )}
        {places.map((p) => (
          <FolderForm key={p.name} connector={p} onChange={load} />
        ))}
      </Section>
      {view.did.length > 0 && (
        <Section title="What it did" about="Its latest reads, newest first.">
          <List>
            {view.did.map((d) => (
              <Row
                key={d.id}
                wrap
                title={<span className={d.failed ? 'text-bad' : undefined}>{d.words}</span>}
                sub={updatedWords(d.at)}
              />
            ))}
          </List>
        </Section>
      )}
      <Confirm
        open={leaving}
        title={`Delete ${c.name}?`}
        yes="Delete"
        busy={busy}
        onClose={() => setLeaving(false)}
        onYes={() => {
          setLeaving(false)
          void act(async () => {
            await api.delete(`/api/computers/${c.id}`)
            window.location.hash = '#/intelligence/connections'
          })
        }}
      >
        Alpha stops reading what it lends and turns its Bridge away. What was read stays; adding the
        computer again needs a new link.
      </Confirm>
    </Record>
  )
}

// A folder on This Mac, added by its path.
function FolderForm({
  connector: c,
  onChange,
}: {
  connector: ConnectorView
  onChange: () => void
}) {
  const [path, setPath] = useState('')
  const [busy, setBusy] = useState(false)
  const [problem, setProblem] = useState<string | null>(null)
  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setProblem(null)
    try {
      await api.post('/api/connections', { connector: c.name, account: path.trim() })
      setPath('')
      onChange()
    } catch (err) {
      setProblem(err instanceof Problem ? err.message : 'That folder was not added.')
    } finally {
      setBusy(false)
    }
  }
  return (
    <form onSubmit={submit} className="flex flex-col gap-2">
      <div className="flex gap-2">
        <Field
          className="flex-1"
          value={path}
          placeholder={c.account.placeholder}
          onChange={(e) => setPath(e.target.value)}
        />
        <Button type="submit" disabled={busy || !path.trim()}>
          Add {c.title.toLowerCase()}
        </Button>
      </div>
      {problem && <div className="text-bad text-md">{problem}</div>}
    </form>
  )
}
