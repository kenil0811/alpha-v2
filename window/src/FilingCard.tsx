// A file that came by mail, waiting to be filed (design §12): the email it came in, a look at
// its first page, what Alpha read it as, how sure and why there. The person files it where Alpha
// proposed, or picks another row or kind first; a second file of that kind on the row can replace
// the first. Decline takes a reason, and the file goes.
import type { CardView, FilingView, FoundRow } from '@alpha/core/api'
import { Search } from 'lucide-react'
import { useState } from 'react'
import { api, Problem } from './api.ts'
import { Button } from './ui/button.tsx'
import { Card } from './ui/card.tsx'
import { Field, Select } from './ui/field.tsx'

const SURE: Record<FilingView['sure'], string> = {
  sure: 'Alpha is sure',
  likely: 'Alpha thinks so',
  unsure: 'Alpha is not sure',
}

const REASONS = ['Not ours', 'Already have it', 'Not a document to keep']

export function FilingCard({ card, filing }: { card: CardView; filing: FilingView }) {
  const first = filing.places.find((p) => p.table === filing.table) ?? filing.places[0]
  const [table, setTable] = useState(first?.table ?? '')
  const place = filing.places.find((p) => p.table === table)
  const [rows, setRows] = useState(place?.rows ?? [])
  const [row, setRow] = useState(filing.row ?? '')
  const [kind, setKind] = useState(filing.kind ?? '')
  const [looking, setLooking] = useState(false)
  const [words, setWords] = useState('')
  const [declining, setDeclining] = useState(false)
  const [always, setAlways] = useState(false)
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const [problem, setProblem] = useState<string | null>(null)
  const pdf = filing.mime === 'application/pdf' || /\.pdf$/i.test(filing.name)
  const changed = row !== (filing.row ?? '') || kind !== (filing.kind ?? '')

  const act = async (path: string, body: unknown) => {
    setBusy(true)
    try {
      await api.post(`/api/cards/${card.id}/${path}`, body)
    } catch (err) {
      setProblem(err instanceof Problem ? err.message : 'That did not go through.')
      setBusy(false)
    }
  }
  // another row of the table, by its words
  const find = async () => {
    if (!words.trim() || !place) return
    const found = await api.get<FoundRow[]>(`/api/find?words=${encodeURIComponent(words.trim())}`)
    const more = found
      .filter((f) => f.hint === place.name)
      .map((f) => ({ id: f.href.split('/').at(-1)?.split('?')[0] ?? '', name: f.label }))
      .filter((r) => r.id && !rows.some((x) => x.id === r.id))
    setRows([...rows, ...more])
    if (more[0]) setRow(more[0].id)
    setLooking(false)
  }

  return (
    <Card label="A file from your mail" waits="Waits for you">
      <div className="font-medium text-ink text-lg">{card.words}</div>
      <div className="text-ink-3 text-sm">
        From {filing.from}: “{filing.subject}”
        {filing.date ? `, ${new Date(filing.date).toLocaleDateString()}` : ''}
      </div>
      <div className="flex gap-3">
        {pdf && (
          <button
            type="button"
            title="See the file"
            className="w-28 shrink-0 overflow-hidden rounded-sm border border-line bg-surface"
            onClick={() => window.location.assign(`#/file/${filing.file}`)}
          >
            <img
              src={api.tokened(`/api/files/${filing.file}/page/1`)}
              alt={`The first page of ${filing.name}`}
              className="block w-full"
            />
          </button>
        )}
        <div className="flex min-w-0 flex-col gap-1.5 text-md">
          <button
            type="button"
            className="truncate text-left text-ink hover:underline"
            onClick={() => window.location.assign(`#/file/${filing.file}`)}
          >
            {filing.name}
          </button>
          {filing.about && <div className="text-ink-2">{filing.about}</div>}
          <div className="text-ink-3 text-sm">
            {SURE[filing.sure]}
            {filing.why ? `: ${filing.why}` : '.'}
          </div>
        </div>
      </div>
      {place && (
        <div className="flex flex-wrap items-center gap-2">
          {filing.places.length > 1 && (
            <Select
              aria-label="Which table"
              value={table}
              onChange={(e) => {
                const next = filing.places.find((p) => p.table === e.target.value)
                setTable(e.target.value)
                setRows(next?.rows ?? [])
                setRow('')
                setKind('')
              }}
            >
              {filing.places.map((p) => (
                <option key={p.table} value={p.table}>
                  {p.name}
                </option>
              ))}
            </Select>
          )}
          <Select
            aria-label={`Which row of ${place.name}`}
            className="min-w-48 flex-1"
            value={row}
            onChange={(e) => setRow(e.target.value)}
          >
            <option value="">Pick a row of {place.name}</option>
            {rows.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </Select>
          <Select
            aria-label="What kind of document"
            value={kind}
            onChange={(e) => setKind(e.target.value)}
          >
            <option value="">No kind given</option>
            {place.kinds.map((k) => (
              <option key={k} value={k}>
                {k}
              </option>
            ))}
          </Select>
          <Button size="sm" variant="ghost" onClick={() => setLooking(!looking)}>
            <Search className="size-3.25" />
            Another row
          </Button>
        </div>
      )}
      {looking && (
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            void find()
          }}
        >
          <Field
            className="flex-1"
            value={words}
            onChange={(e) => setWords(e.target.value)}
            placeholder={`Words of the ${place?.name ?? 'row'} it goes on`}
          />
          <Button type="submit" size="sm">
            Find
          </Button>
        </form>
      )}
      {!changed && filing.already.length > 0 && (
        <div className="text-sm text-warn">
          That row has a {filing.kind} already: {filing.already.join(', ')}.
        </div>
      )}
      {always && filing.always ? (
        <div className="flex flex-col gap-2 rounded-md border border-accent-line bg-accent-soft/40 p-3">
          <div className="text-ink text-md">{filing.always}?</div>
          <div className="text-ink-3 text-sm">
            This one is filed now, and the next ones without a card, each shown on Home. Revoke it
            any time in Settings › Standing permissions.
          </div>
          <div className="flex gap-2">
            <Button
              variant="primary"
              disabled={busy}
              onClick={() => act('file', { row, kind: kind || null, always: true })}
            >
              File it, and always
            </Button>
            <Button variant="ghost" onClick={() => setAlways(false)}>
              Back
            </Button>
          </div>
        </div>
      ) : declining ? (
        <form
          className="flex flex-col gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            void act('decline', { reason })
          }}
        >
          <div className="flex flex-wrap gap-1.5">
            {REASONS.map((r) => (
              <Button
                key={r}
                size="sm"
                variant={reason === r ? 'primary' : 'default'}
                onClick={() => setReason(r)}
              >
                {r}
              </Button>
            ))}
          </div>
          <div className="flex gap-2">
            <Field
              className="flex-1"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Why not, in a few words"
            />
            <Button type="submit" variant="warn" disabled={busy}>
              Decline
            </Button>
            <Button variant="ghost" onClick={() => setDeclining(false)}>
              Back
            </Button>
          </div>
        </form>
      ) : (
        <div className="flex flex-wrap gap-2">
          <Button
            variant="primary"
            disabled={busy}
            onClick={() => act('file', { row: row || null, kind: row ? kind || null : null })}
          >
            {!row
              ? 'Keep it in Alpha'
              : !changed && filing.already.length
                ? 'File it beside'
                : 'File it'}
          </Button>
          {!changed && filing.already.length > 0 && (
            <Button
              disabled={busy}
              onClick={() => act('file', { row, kind: kind || null, replace: true })}
            >
              Replace it
            </Button>
          )}
          <Button disabled={busy} onClick={() => setDeclining(true)}>
            Decline
          </Button>
          {filing.always && !changed && (
            <Button variant="ghost" disabled={busy} onClick={() => setAlways(true)}>
              Always…
            </Button>
          )}
        </div>
      )}
      {problem && <div className="text-bad text-sm">{problem}</div>}
    </Card>
  )
}
