// Home's one optional card for an extra permission (core/config/offers.yaml; proposed, Vikas 23
// Nov): shown only once the core says its prerequisite is met, one at a time, never in Set up
// Alpha; a tick says yes, a cross says not now. Safari's yes opens Full Disk Access through Alpha
// Bridge and says what to turn on there.
import { ShieldCheck } from 'lucide-react'
import { useEffect, useState } from 'react'
import { api } from './api.ts'
import { Refusal, useAct } from './ui/act.tsx'
import { CodeLine } from './ui/code-line.tsx'
import { YesNo } from './ui/yes-no.tsx'

interface Offer {
  key: string
  title: string
  says: string
}

export function OfferCard({ version }: { version: unknown }) {
  const [offer, setOffer] = useState<Offer | null>(null)
  const [safari, setSafari] = useState<boolean | null>(null) // Safari said yes: opened there or not
  const { busy, problem, act } = useAct()
  useEffect(() => {
    void version
    api.get<{ offer: Offer | null }>('/api/offers').then(
      (r) => setOffer(r.offer),
      () => undefined,
    )
  }, [version])
  if (safari !== null)
    return (
      <div className="flex flex-col gap-2 rounded-md border border-line bg-surface px-3 py-2.5 text-md">
        <p className="text-ink">
          {safari
            ? 'System Settings opened on your Mac. Turn on Alpha Bridge in Full Disk Access; Alpha starts reading Safari by itself once it can.'
            : 'Open System Settings on your Mac, then Privacy & Security, Full Disk Access, and turn on Alpha Bridge.'}
        </p>
        <CodeLine text="Privacy & Security › Full Disk Access › Alpha Bridge" />
      </div>
    )
  if (!offer) return null
  const answer = (yes: boolean) =>
    act(async () => {
      const r = await api.post<{ offer: Offer | null; opened: boolean }>(
        `/api/offers/${offer.key}`,
        { yes },
      )
      if (yes && offer.key === 'safari') setSafari(r.opened)
      setOffer(r.offer)
    })
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-md border border-line bg-surface px-3 py-2.5">
      <ShieldCheck className="size-3.5 shrink-0 text-accent" />
      <div className="min-w-0 flex-1">
        <p className="text-ink text-md">{offer.title}</p>
        <p className="text-ink-3 text-sm">{offer.says}</p>
      </div>
      <Refusal words={problem} />
      <YesNo
        value={null}
        yes="Yes"
        no="Not now"
        disabled={busy}
        onChange={(a) => answer(a === 'yes')}
      />
    </div>
  )
}
