// A module's page (design §13): its file in a sandboxed frame that can reach nothing but this
// window. The window answers the page's questions from the core (its module's rows, read-only),
// sends it the window's look, sizes the frame to it, opens what the page asks to open, and prints
// it to a PDF with the page's choices.
import type { ModuleView, PageSummary, TableView as TableData } from '@alpha/core/api'
import { Download } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { api, Problem, wordsOf } from './api.ts'
import { SourcePanel } from './table/SourcePanel.tsx'
import { show } from './table/values.ts'
import { Button } from './ui/button.tsx'

// the window's look, handed to the page as its variables
const LOOK = [
  '--canvas',
  '--surface',
  '--sunk',
  '--hover',
  '--ink',
  '--ink-2',
  '--ink-3',
  '--line',
  '--hair',
  '--accent',
  '--accent-soft',
  '--accent-line',
  '--good',
  '--good-soft',
  '--warn',
  '--warn-soft',
  '--bad',
  '--bad-soft',
]

function look() {
  const style = getComputedStyle(document.documentElement)
  const vars = Object.fromEntries(LOOK.map((v) => [v, style.getPropertyValue(v).trim()]))
  return { vars, dark: style.colorScheme === 'dark' }
}

// What a page may ask the window to open: some of a table's rows, or one row (and its field's
// source).
type Target = { table?: string; rows?: string[]; row?: string; field?: string }

function tableOf(m: ModuleView, target: Target) {
  return m.tables.find((x) => x.name.toLowerCase() === String(target.table ?? '').toLowerCase())
}

function openTarget(m: ModuleView, target: Target) {
  const t = tableOf(m, target)
  if (!t) return
  if (target.row)
    window.location.hash = `#/table/${t.id}/${target.row}${target.field ? `?field=${encodeURIComponent(target.field)}` : ''}`
  else if (Array.isArray(target.rows))
    window.location.hash = `#/table/${t.id}?only=${target.rows.map(encodeURIComponent).join(',')}`
  else window.location.hash = `#/table/${t.id}`
}

export function PageView({
  m,
  page,
  version,
}: {
  m: ModuleView
  page: PageSummary
  version: number // a change in the world: the page asks again
}) {
  const frame = useRef<HTMLIFrameElement>(null)
  const [html, setHtml] = useState<string | null>(null)
  const [height, setHeight] = useState(480)
  const [problem, setProblem] = useState<string | null>(null)
  const [printing, setPrinting] = useState(false)
  const [asks, setAsks] = useState<string | null>(null)
  // a figure's source, opened beside the page (item 59 of the problems list, 25 Oct): the page
  // stays where it was, and closing the panel leaves the person on it
  const [source, setSource] = useState<{ table: TableData; row: string; field: string } | null>(
    null,
  )
  const inputs = useRef<Record<string, string>>({})
  const base = `/api/modules/${m.id}/pages/${page.name}`

  useEffect(() => {
    setHtml(null)
    setProblem(null)
    api.get<{ html: string }>(base).then(
      (p) => setHtml(p.html),
      (err) => setProblem(err instanceof Problem ? err.message : 'The page did not load.'),
    )
  }, [base])

  const send = () => frame.current?.contentWindow?.postMessage({ alpha: 'theme', ...look() }, '*')
  useEffect(() => {
    if (version >= 0) frame.current?.contentWindow?.postMessage({ alpha: 'refresh' }, '*')
  }, [version])
  // the open source follows the world too: a value corrected in the panel shows at once
  const sourceTable = source?.table.id
  useEffect(() => {
    if (version < 0 || !sourceTable) return
    api.get<TableData>(`/api/tables/${sourceTable}`).then(
      (table) => setSource((s) => (s && s.table.id === table.id ? { ...s, table } : s)),
      () => undefined,
    )
  }, [version, sourceTable])

  useEffect(() => {
    const onMessage = async (e: MessageEvent) => {
      const win = frame.current?.contentWindow
      if (!win || e.source !== win) return
      const msg = (e.data ?? {}) as {
        alpha?: string
        id?: number
        op?: string
        args?: Record<string, unknown>
        height?: number
        target?: Target
        values?: Record<string, string>
        words?: string
      }
      if (msg.alpha === 'ask') {
        try {
          const { value } = await api.post<{ value: unknown }>(`${base}/ask`, {
            op: msg.op,
            args: msg.args ?? {},
          })
          win.postMessage({ alpha: 'answer', id: msg.id, value }, '*')
        } catch (err) {
          const words = wordsOf(err)
          win.postMessage({ alpha: 'answer', id: msg.id, problem: words }, '*')
        }
      } else if (msg.alpha === 'height' && typeof msg.height === 'number') {
        setHeight(Math.max(120, msg.height))
      } else if (msg.alpha === 'open' && msg.target) {
        const target = msg.target
        const t = tableOf(m, target)
        // one value of one row: its source beside the page; anything else opens the table
        if (t && target.row && target.field) {
          try {
            const table = await api.get<TableData>(`/api/tables/${t.id}`)
            const want = target.field.toLowerCase()
            const field = table.fields.find((f) => f.name.toLowerCase() === want || f.slug === want)
            if (field && table.rows.some((r) => r.id === target.row))
              setSource({ table, row: target.row, field: field.slug })
            else openTarget(m, target)
          } catch (err) {
            setProblem(wordsOf(err))
          }
        } else openTarget(m, target)
      } else if (msg.alpha === 'inputs' && msg.values) {
        inputs.current = msg.values
      } else if (msg.alpha === 'say' && typeof msg.words === 'string' && msg.words.trim()) {
        // a page's button asks Alpha in the person's words: shown outside the frame and sent
        // only when the person says so (item 5 of the problems list, 24 Oct)
        setAsks(msg.words.trim().slice(0, 500))
      }
    }
    window.addEventListener('message', onMessage)
    // the page follows the window's light or dark
    const themed = new MutationObserver(send)
    themed.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })
    const mac = window.matchMedia('(prefers-color-scheme: dark)')
    mac.addEventListener('change', send)
    return () => {
      window.removeEventListener('message', onMessage)
      themed.disconnect()
      mac.removeEventListener('change', send)
    }
  })

  const print = async () => {
    setPrinting(true)
    setProblem(null)
    try {
      await api.download(`${base}/pdf`, { inputs: inputs.current }, `${page.title}.pdf`)
    } catch (err) {
      setProblem(err instanceof Problem ? err.message : 'The PDF was not made.')
    } finally {
      setPrinting(false)
    }
  }

  const ask = async () => {
    const words = asks
    setAsks(null)
    if (!words) return
    try {
      await api.post('/api/say', { words, from: m.id })
    } catch (err) {
      setProblem(wordsOf(err))
    }
  }

  const opened = source && {
    row: source.table.rows.find((r) => r.id === source.row),
    field: source.table.fields.find((f) => f.slug === source.field),
    first: source.table.fields.find((f) => f.kind === 'text'),
  }
  return (
    <div className="flex h-full min-h-0">
      <div className="min-w-0 flex-1 overflow-y-auto">
        {asks && (
          <div className="flex max-w-page items-center gap-3 border-hair border-b bg-surface px-7 py-2.5">
            <span className="min-w-0 flex-1 truncate text-ink text-md">
              This page asks Alpha: “{asks}”
            </span>
            <Button size="sm" variant="ghost" onClick={() => setAsks(null)}>
              Cancel
            </Button>
            <Button size="sm" onClick={ask}>
              Ask Alpha
            </Button>
          </div>
        )}
        <div className="flex max-w-page items-center gap-3 px-7 pt-4">
          <span className="min-w-0 flex-1 truncate text-ink-3 text-sm">
            {problem ?? (html ? '' : 'Loading the page…')}
          </span>
          <Button size="sm" disabled={!html || printing} onClick={print}>
            <Download className="size-3.25" />
            {printing ? 'Making the PDF…' : 'Download PDF'}
          </Button>
        </div>
        {html && (
          <iframe
            ref={frame}
            title={page.title}
            sandbox="allow-scripts"
            srcDoc={html}
            onLoad={send}
            className="block w-full border-0"
            style={{ height }}
          />
        )}
      </div>
      {source && opened?.row && opened.field && (
        <SourcePanel
          tableId={source.table.id}
          table={source.table.name}
          row={opened.row}
          field={opened.field}
          rowName={
            opened.first
              ? show(opened.first, opened.row.values[opened.first.slug], source.table.names)
              : ''
          }
          names={source.table.names}
          onClose={() => setSource(null)}
        />
      )}
    </div>
  )
}
