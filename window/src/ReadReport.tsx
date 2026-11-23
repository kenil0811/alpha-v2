// What Alpha read (Vikas, 23 Nov): one live line wherever reading happens ("I've read 1,204
// emails, 38 events and 212 pages so far"), and the report it opens, Settings › What Alpha read:
// per source, who allowed it and when, what its reads met, kept, left out and passed over, and
// the rows made from them, each opening beside the page (L14); then what each person let Get to
// know you read and what they did with its lines. Every count is the core's (api/read-report.ts).
import type { ReadReportView, ReadSourceView, ReadTableView } from '@alpha/core/api'
import { ChevronRight } from 'lucide-react'
import { useEffect, useState } from 'react'
import { api, wordsOf } from './api.ts'
import { dayWords } from './time.ts'
import { List, Row } from './ui/list.tsx'
import { Empty, Section } from './ui/section.tsx'
import { Waiting } from './ui/waiting.tsx'

// The report, read again at each new journal line and every 2 seconds while a read runs.
function useReport(version: unknown): { report: ReadReportView | null; problem: string | null } {
  const [report, setReport] = useState<ReadReportView | null>(null)
  const [problem, setProblem] = useState<string | null>(null)
  const [tick, setTick] = useState(0)
  useEffect(() => {
    void version
    void tick
    api.get<ReadReportView>('/api/read-report').then(
      (r) => {
        setReport(r)
        setProblem(null)
      },
      (e) => setProblem(wordsOf(e)),
    )
  }, [version, tick])
  useEffect(() => {
    if (!report?.reading) return
    const t = setTimeout(() => setTick((x) => x + 1), 2000)
    return () => clearTimeout(t)
  }, [report])
  return { report, problem }
}

export const READ_REPORT = '#/settings/read'

// The live line: nothing until something was read. onOpen runs before the report opens (Set up
// Alpha closes over it first, and waits on Home to carry on).
export function ReadLine({ version, onOpen }: { version?: unknown; onOpen?: () => void }) {
  const { report } = useReport(version)
  if (!report?.says) return null
  return (
    <a
      href={READ_REPORT}
      onClick={(e) => {
        if (!onOpen) return
        e.preventDefault()
        onOpen()
        window.location.hash = READ_REPORT
      }}
      className="inline-flex items-center gap-1 self-start text-ink-2 text-md hover:text-ink"
    >
      {report.says}
      <ChevronRight className="size-3.5 text-ink-3" />
    </a>
  )
}

const n = (x: number) => x.toLocaleString()
const date = (at: string) =>
  new Date(at).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    ...(new Date(at).getFullYear() === new Date().getFullYear() ? {} : { year: 'numeric' }),
  })

function TableLine({ t }: { t: ReadTableView }) {
  const made = t.added + t.changed
  const parts = [
    `${n(t.read)} read`,
    `${n(t.kept)} kept`,
    t.leftOut ? `${n(t.leftOut)} left out on the never-use list` : '',
    t.skipped ? `${n(t.skipped)} passed over` : '',
  ].filter(Boolean)
  return (
    <div className="flex flex-wrap items-baseline gap-x-2 border-hair border-t py-2 pr-4 pl-8 text-md">
      {t.table ? (
        <a className="font-medium text-ink hover:underline" href={`#/table/${t.table}`}>
          {t.name}
        </a>
      ) : (
        <span className="font-medium text-ink">{t.name}</span>
      )}
      <span className="text-ink-2">{parts.join(' · ')}</span>
      {made > 0 &&
        (t.table && t.rows.length ? (
          <a
            className="text-accent hover:underline"
            href={`#/table/${t.table}?only=${t.rows.join(',')}`}
          >
            {n(t.added)} new, {n(t.changed)} changed
            {made > t.rows.length ? ` (the newest ${t.rows.length} open)` : ''}
          </a>
        ) : (
          <span className="text-ink-2">
            {n(t.added)} new, {n(t.changed)} changed
          </span>
        ))}
    </div>
  )
}

function sourceSub(s: ReadSourceView): string {
  return [
    s.allowed ? `Allowed by ${s.allowed.by} on ${date(s.allowed.at)}` : '',
    s.reading
      ? 'Reading now'
      : s.lastReadAt
        ? `read ${n(s.reads)} time${s.reads === 1 ? '' : 's'}, last ${dayWords(s.lastReadAt).replace(/^now$/, 'just now')}`
        : 'not read yet',
    s.failed ? `${n(s.failed)} failed` : '',
    s.off ?? '',
  ]
    .filter(Boolean)
    .join(' · ')
}

export function ReadReport({ version }: { version: number }) {
  const { report, problem } = useReport(version)
  if (!report) return problem ? <p className="text-ink-3">{problem}</p> : <Waiting />
  return (
    <div className="flex flex-col gap-8">
      <Section
        title="What Alpha read"
        about="Each source Alpha reads, who allowed it and when, how much it read and kept, what it left out and why, and the rows it made. Counted as it read, never guessed. Skipped items are on the never-use list, or ones a read only keeps up to date or you deleted before."
      >
        {report.says && <p className="text-ink-2 text-md">{report.says}.</p>}
        {report.sources.length ? (
          <List>
            {report.sources.map((s) => (
              <Row key={s.connection} title={`${s.title} · ${s.account}`} sub={sourceSub(s)} wrap>
                {s.tables.map((t) => (
                  <TableLine key={t.table ?? t.name} t={t} />
                ))}
              </Row>
            ))}
          </List>
        ) : (
          <Empty>Nothing is connected yet: what Alpha reads shows here, source by source.</Empty>
        )}
      </Section>
      {report.learned.length > 0 && (
        <Section
          title="Get to know you"
          about="What each person let Alpha read in Set up Alpha's Get to know you, what they switched off, and what they did with the lines it proposed in What I learned."
        >
          <List>
            {report.learned.map((l) => (
              <Row
                key={l.person}
                title={l.person}
                wrap
                sub={[
                  `Read on ${date(l.at)}: ${l.read.join(', ') || 'nothing'}`,
                  l.off.length ? `switched off: ${l.off.join(', ')}` : '',
                  `${n(l.kept)} lines kept, ${n(l.dropped)} dropped`,
                  l.yes + l.no ? `${n(l.yes)} ideas agreed, ${n(l.no)} declined` : '',
                ]
                  .filter(Boolean)
                  .join(' · ')}
              />
            ))}
          </List>
        </Section>
      )}
    </div>
  )
}
