// Settings › Reports (Vikas, 25 Oct): every report in every module in one list. A module's pages
// print to PDF; a table's saved views (or the whole table, when it has none) download as Excel or
// CSV, with the view's filters, sorts and columns, narrowed to a period by the table's first date
// column. Sending a report on a schedule waits for the core.
import type {
  FieldView,
  ModuleSummary,
  RowView,
  SavedView,
  TableView as TableData,
} from '@alpha/core/api'
import { FileText, Table2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { api, wordsOf } from './api.ts'
import { ModuleIcon } from './moduleIcon.tsx'
import { applyFilters, applySearch, columns, complete, sortRows } from './table/engine.ts'
import { Refusal, useAct } from './ui/act.tsx'
import { Button } from './ui/button.tsx'
import { Select } from './ui/field.tsx'
import { List, Row, Tile } from './ui/list.tsx'
import { Empty, Section } from './ui/section.tsx'

const PERIODS = {
  all: 'All time',
  month: 'This month',
  last: 'Last month',
  quarter: 'This quarter',
  year: 'This year',
} as const
type Period = keyof typeof PERIODS

// the first and last day of a period, as YYYY-MM-DD, or null for all time
export function span(period: Period, now = new Date()): [string, string] | null {
  const y = now.getFullYear()
  const m = now.getMonth()
  const day = (yy: number, mm: number, dd: number) =>
    new Date(yy, mm, dd).toLocaleDateString('en-CA')
  if (period === 'month') return [day(y, m, 1), day(y, m + 1, 0)]
  if (period === 'last') return [day(y, m - 1, 1), day(y, m, 0)]
  if (period === 'quarter') {
    const q = m - (m % 3)
    return [day(y, q, 1), day(y, q + 3, 0)]
  }
  if (period === 'year') return [day(y, 0, 1), day(y, 11, 31)]
  return null
}

const count = (n: number) => `${n} row${n === 1 ? '' : 's'}`

const dateField = (t: TableData) => t.fields.find((f) => f.kind === 'date') ?? null

// the rows a view shows, in its order, inside the period
export function reportRows(t: TableData, view: SavedView | null, period: Period): RowView[] {
  const config = complete(view?.config)
  let rows = applyFilters(t.rows, t.fields, config.filters, t.names)
  rows = applySearch(rows, t.fields, config.search, t.names)
  const when = span(period)
  const by = dateField(t)
  if (when && by)
    rows = rows.filter((r) => {
      const v = String(r.values[by.slug] ?? '').slice(0, 10)
      return v >= when[0] && v <= when[1]
    })
  return sortRows(rows, t.fields, config.sorts, t.names)
}

export function Reports() {
  const [modules, setModules] = useState<ModuleSummary[] | null>(null)
  const [tables, setTables] = useState<Record<string, TableData>>({})
  const [problem, setProblem] = useState<string | null>(null)
  const [only, setOnly] = useState('')
  const [period, setPeriod] = useState<Period>('all')
  useEffect(() => {
    api.get<ModuleSummary[]>('/api/modules').then(
      async (all) => {
        setModules(all)
        const got = await Promise.all(
          all.flatMap((m) => m.tables).map((t) => api.get<TableData>(`/api/tables/${t.id}`)),
        )
        setTables(Object.fromEntries(got.map((t) => [t.id, t])))
      },
      (e) => setProblem(wordsOf(e)),
    )
  }, [])
  if (!modules) return <p className="text-ink-3">{problem ?? 'Loading…'}</p>

  const named = (m: ModuleSummary): string => {
    const up = modules.find((x) => x.id === m.parent)
    return up ? `${named(up)} › ${m.name}` : m.name
  }
  const shown = modules
    .filter((m) => !only || m.id === only)
    .filter((m) => m.pages.length || m.tables.length)
    .sort((a, b) => named(a).localeCompare(named(b)))
  return (
    <Section
      title="Reports"
      about="Every report in every module: printed pages as PDF, tables and their saved views as Excel or CSV."
    >
      <div className="flex flex-wrap gap-2">
        <Select aria-label="Module" value={only} onChange={(e) => setOnly(e.target.value)}>
          <option value="">All modules</option>
          {modules
            .filter((m) => m.pages.length || m.tables.length)
            .map((m) => (
              <option key={m.id} value={m.id}>
                {named(m)}
              </option>
            ))}
        </Select>
        <Select
          aria-label="Period"
          value={period}
          onChange={(e) => setPeriod(e.target.value as Period)}
        >
          {Object.entries(PERIODS).map(([k, w]) => (
            <option key={k} value={k}>
              {w}
            </option>
          ))}
        </Select>
      </div>
      {shown.length === 0 ? (
        <Empty>A module’s pages and tables show here once it has some.</Empty>
      ) : (
        shown.map((m) => (
          <div key={m.id} className="flex flex-col gap-2">
            <h3 className="flex items-center gap-2 font-medium text-ink text-md">
              <ModuleIcon name={m.name} className="size-4 text-ink-3" />
              {named(m)}
            </h3>
            <List>
              {m.pages.map((p) => (
                <Row
                  key={`p:${p.name}`}
                  lead={
                    <Tile>
                      <FileText className="size-4" />
                    </Tile>
                  }
                  title={p.title}
                  sub="A page, printed as it shows now"
                  actions={
                    <Download
                      formats={['pdf']}
                      get={() =>
                        api.download(
                          `/api/modules/${m.id}/pages/${p.name}/pdf`,
                          { inputs: {} },
                          `${p.title}.pdf`,
                        )
                      }
                    />
                  }
                />
              ))}
              {m.tables.flatMap((s) => {
                const t = tables[s.id]
                if (!t) return []
                const views: (SavedView | null)[] = t.views.length ? t.views : [null]
                const by = dateField(t)
                return views.map((v) => (
                  <Row
                    key={`v:${t.id}:${v?.id ?? 'all'}`}
                    lead={
                      <Tile>
                        <Table2 className="size-4" />
                      </Tile>
                    }
                    title={v ? `${t.name} · ${v.name}` : t.name}
                    sub={`${count(reportRows(t, v, period).length)}${
                      period === 'all'
                        ? ''
                        : by
                          ? `, by ${by.name}`
                          : ', all of them: no date column'
                    }${v?.about ? ` · ${v.about}` : ''}`}
                    actions={
                      <Download
                        formats={['xlsx', 'csv']}
                        get={(as) =>
                          api.download(
                            `/api/tables/${t.id}/export`,
                            {
                              rows: reportRows(t, v, period).map((r) => r.id),
                              fields: columns(t.fields, complete(v?.config)).map(
                                (f: FieldView) => f.id,
                              ),
                              as,
                            },
                            `${v ? `${t.name} – ${v.name}` : t.name}.${as}`,
                          )
                        }
                      />
                    }
                  />
                ))
              })}
            </List>
          </div>
        ))
      )}
    </Section>
  )
}

const FORMAT = { pdf: 'PDF', xlsx: 'Excel', csv: 'CSV' } as const

function Download({
  formats,
  get,
}: {
  formats: (keyof typeof FORMAT)[]
  get: (as: keyof typeof FORMAT) => Promise<unknown>
}) {
  const { busy, problem, act } = useAct()
  return (
    <>
      <Refusal words={problem} />
      {formats.map((f) => (
        <Button key={f} size="sm" disabled={busy} onClick={() => act(() => get(f as never))}>
          {FORMAT[f]}
        </Button>
      ))}
    </>
  )
}
