// Onboarding from the footprint (Vikas, 30 Oct: Alpha reads first, asks last), at the head of the
// Interviewer's thread until the owner goes on to the questions: what Alpha could read and how
// much, each ticked by the owner (nothing is read before a tick); Read what I ticked; the AI-memory
// paste-back; Draft my business, confirmed or dropped on the one review card that follows; then
// Ask me the rest, the interview of what is left. Governance keeps the ledger (FootprintLedger).
import type { CardView, FootprintView } from '@alpha/core/api'
import { Copy } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { api } from './api.ts'
import { ReviewCard } from './ReviewCard.tsx'
import { Refusal, useAct } from './ui/act.tsx'
import { Button } from './ui/button.tsx'
import { Actions, Card } from './ui/card.tsx'
import { Label } from './ui/pill.tsx'
import { Switch } from './ui/switch.tsx'
import { UpdateNow } from './ui/update-now.tsx'

const BOX =
  'w-full rounded-md border border-line bg-surface px-2.5 py-1.5 text-ink text-md outline-none focus:border-accent-line focus:ring-3 focus:ring-accent-soft'
const CONNECT: Record<string, string> = {
  gmail: 'Gmail',
  contacts: 'Contacts',
  calendar: 'Calendar',
}

export function useFootprint() {
  const [view, setView] = useState<FootprintView | null>(null)
  const load = useCallback(
    () => api.get<FootprintView>('/api/footprint').then(setView, () => undefined),
    [],
  )
  useEffect(() => {
    void load()
  }, [load])
  return { view, setView, load }
}

export function Footprint({ cards, onAsk }: { cards: CardView[]; onAsk: () => void }) {
  const { view, setView } = useFootprint()
  const { busy, on, problem, act } = useAct()
  const [site, setSite] = useState('')
  const [memory, setMemory] = useState('')
  const [copied, setCopied] = useState(false)
  const post = (path: string, body?: unknown) =>
    api.post<FootprintView>(`/api/footprint/${path}`, body).then(setView)
  // the first open counts at once: numbers only
  const counted = !!view?.countedAt
  useEffect(() => {
    if (view && !counted) void act(() => post('count'), 'count')
  }, [!!view, counted])
  useEffect(() => {
    if (view?.site) setSite(view.site)
  }, [view?.site])
  if (!view || view.done) return null
  const ticked = view.sources.filter((s) => s.ticked)
  const read = view.sources.filter((s) => s.read)
  const card = view.card ? cards.find((c) => c.id === view.card) : undefined
  return (
    <div className="flex flex-col gap-4">
      <Card label="Before the questions">
        <p className="text-ink-2">
          Alpha learns your business from what is already on this Mac, then asks only what is left.
          It reads only what you tick, here on this Mac.
        </p>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Label>What Alpha could read</Label>
          <UpdateNow
            at={view.countedAt}
            busy={busy && on === 'count'}
            onClick={() => act(() => post('count'), 'count')}
          />
        </div>
        <div className="overflow-hidden rounded-md border border-line">
          {view.sources.map((s) => (
            <div
              key={s.id}
              className="flex items-center gap-3 border-hair border-t px-3 py-2 first:border-t-0"
            >
              <span className="min-w-0 flex-1">
                <span className="block font-medium text-base text-ink">{s.title}</span>
                <span className="block text-ink-3 text-sm">
                  {s.read
                    ? `Read ${s.read.read.toLocaleString()} ${s.unit}${s.read.why ? `; ${s.read.why}` : ''}`
                    : s.sub}
                </span>
                {s.id === 'website' && s.ticked && (
                  <input
                    aria-label="Your website"
                    placeholder="yourbusiness.com"
                    className={`${BOX} mt-1.5 max-w-80`}
                    value={site}
                    onChange={(e) => setSite(e.target.value)}
                    onBlur={() =>
                      site !== (view.site ?? '') && act(() => post('site', { site }), 'site')
                    }
                    onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
                  />
                )}
              </span>
              {s.needs ? (
                <a
                  href={`#/settings?connect=${s.needs}`}
                  className="shrink-0 text-accent text-sm hover:underline"
                >
                  Connect {CONNECT[s.needs] ?? s.title}
                </a>
              ) : (
                s.count !== null && (
                  <span className="shrink-0 text-ink-2 text-sm tabular-nums">
                    {s.count.toLocaleString()} {s.unit}
                  </span>
                )
              )}
              {/* the switch last, right of any button or link (Vikas, 2 Nov) */}
              <Switch
                checked={s.ticked}
                label={`Read ${s.title.toLowerCase()}`}
                disabled={busy || !!s.needs}
                onChange={(v) => act(() => post('tick', { source: s.id, on: v }), s.id)}
              />
            </div>
          ))}
        </div>
        {view.denied && (
          <p className="text-ink-3 text-sm">
            Money and health sites are never read: they are your rules in{' '}
            <a href="#/settings/governance" className="text-accent hover:underline">
              Governance
            </a>
            , where you can change them.
          </p>
        )}
        <Actions>
          {!['count', 'site'].includes(on ?? '') && <Refusal words={problem} />}
          <Button
            variant="primary"
            disabled={busy || !ticked.length}
            aria-busy={busy && on === 'read'}
            onClick={() => act(() => post('read'), 'read')}
          >
            {busy && on === 'read' ? 'Reading…' : read.length ? 'Read again' : 'Read what I ticked'}
          </Button>
        </Actions>

        <Label>What your AI knows of you</Label>
        <p className="text-ink-2 text-sm">
          Copy this into ChatGPT, Claude or Gemini and paste its answer below. Each fact stays
          unconfirmed until you confirm it.
        </p>
        <div className="flex items-start gap-2">
          <p className="min-w-0 flex-1 whitespace-pre-wrap rounded-md bg-sunk px-2.5 py-2 text-ink-2 text-sm">
            {view.memoryPrompt}
          </p>
          <Button
            size="sm"
            onClick={() =>
              navigator.clipboard.writeText(view.memoryPrompt).then(
                () => setCopied(true),
                () => undefined,
              )
            }
          >
            <Copy className="size-3.5" />
            {copied ? 'Copied' : 'Copy'}
          </Button>
        </div>
        <textarea
          aria-label="Your AI's answer"
          placeholder="Paste your AI's answer here"
          rows={3}
          className={BOX}
          value={memory}
          onChange={(e) => setMemory(e.target.value)}
        />
        <Actions>
          {on === 'memory' && <Refusal words={problem} />}
          <Button
            disabled={busy || !memory.trim()}
            onClick={() =>
              act(() => post('memory', { words: memory }).then(() => setMemory('')), 'memory')
            }
          >
            Add these
          </Button>
        </Actions>

        <Label>Your business, drafted</Label>
        <p className="text-ink-2 text-sm">
          From what Alpha read, a draft of who you are, your clients and suppliers, your tools and
          how the work runs, each fact with where it came from. You confirm or drop each; a
          double-click on one fixes it.
        </p>
        <Actions>
          {on === 'draft' && <Refusal words={problem} />}
          <Button
            disabled={busy || !read.length}
            aria-busy={busy && on === 'draft'}
            onClick={() => act(() => post('draft'), 'draft')}
          >
            {busy && on === 'draft' ? 'Drafting…' : 'Draft my business'}
          </Button>
          <Button
            variant="primary"
            disabled={busy}
            onClick={() => act(() => post('done').then(onAsk), 'done')}
          >
            Ask me the rest
          </Button>
        </Actions>
      </Card>
      {card?.review && <ReviewCard card={card} review={card.review} />}
    </div>
  )
}
