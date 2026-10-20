// A module's page (design §13): its file in a sandboxed frame that can reach nothing but this
// window. The window answers the page's questions from the core (its module's rows, read-only),
// sends it the window's look, sizes the frame to it, opens what the page asks to open, and prints
// it to a PDF with the page's choices.
import type { ModuleView, PageSummary } from '@alpha/core/api'
import { Download } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { api, Problem } from './api.ts'
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

function openTarget(m: ModuleView, target: Target) {
  const t = m.tables.find((x) => x.name.toLowerCase() === String(target.table ?? '').toLowerCase())
  if (!t) return
  if (target.row) window.location.hash = `#/table/${t.id}/${target.row}`
  else if (Array.isArray(target.rows))
    window.location.hash = `#/table/${t.id}?only=${target.rows.map(encodeURIComponent).join(',')}`
  else window.location.hash = `#/table/${t.id}`
}

export function PageView({ m, page }: { m: ModuleView; page: PageSummary }) {
  const frame = useRef<HTMLIFrameElement>(null)
  const [html, setHtml] = useState<string | null>(null)
  const [height, setHeight] = useState(480)
  const [problem, setProblem] = useState<string | null>(null)
  const [printing, setPrinting] = useState(false)
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
      }
      if (msg.alpha === 'ask') {
        try {
          const { value } = await api.post<{ value: unknown }>(`${base}/ask`, {
            op: msg.op,
            args: msg.args ?? {},
          })
          win.postMessage({ alpha: 'answer', id: msg.id, value }, '*')
        } catch (err) {
          const words = err instanceof Problem ? err.message : 'The core did not answer.'
          win.postMessage({ alpha: 'answer', id: msg.id, problem: words }, '*')
        }
      } else if (msg.alpha === 'height' && typeof msg.height === 'number') {
        setHeight(Math.max(120, msg.height))
      } else if (msg.alpha === 'open' && msg.target) {
        openTarget(m, msg.target)
      } else if (msg.alpha === 'inputs' && msg.values) {
        inputs.current = msg.values
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

  return (
    <div className="h-full overflow-y-auto">
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
  )
}
