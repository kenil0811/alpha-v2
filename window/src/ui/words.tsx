// Alpha's replies as the model writes them: Markdown, drawn in the kit's thin look. No raw HTML.
// In the stream, a table too wide for the text runs wider, up to the wide width (app.css `wide`).
import { type ReactNode, useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import Markdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { cn } from './cn.ts'

const TABLE =
  'w-fit border-collapse text-base [&_td]:border-b [&_td]:border-hair [&_td]:px-2 [&_td]:py-1 [&_th]:border-b [&_th]:border-line [&_th]:px-2 [&_th]:py-1 [&_th]:text-left [&_th]:font-normal [&_th]:text-ink-2'

// A table that, when its natural width is more than the text's, takes the wide width.
function WideTable({ children }: { children: ReactNode }) {
  const box = useRef<HTMLDivElement>(null)
  const [over, setOver] = useState(false)
  const measure = useCallback(() => {
    const table = box.current?.firstElementChild as HTMLElement | null
    const text = box.current?.parentElement
    if (!table || !text) return
    table.style.width = 'max-content'
    const natural = table.offsetWidth
    table.style.width = ''
    setOver(natural > text.clientWidth)
  }, [])
  // rows arrive while a reply streams in, so it is measured on every render
  useLayoutEffect(measure)
  useEffect(() => {
    const text = box.current?.parentElement
    if (!text) return
    const watch = new ResizeObserver(measure)
    watch.observe(text)
    return () => watch.disconnect()
  }, [measure])
  return (
    <div ref={box} className={cn('overflow-x-auto', over && 'wide')}>
      <table className={TABLE}>{children}</table>
    </div>
  )
}

export function Words({ text, wideTables }: { text: string; wideTables?: boolean }) {
  return (
    <div className="flex flex-col gap-3 leading-relaxed [&_a]:underline [&_code]:rounded [&_code]:bg-sunk [&_code]:px-1 [&_code]:text-md [&_ol]:list-decimal [&_ol]:pl-5 [&_h1]:font-medium [&_h1]:font-serif [&_h1]:text-xl [&_h2]:font-medium [&_h2]:font-serif [&_h2]:text-lg [&_h3]:font-semibold [&_strong]:font-medium [&_ul]:list-disc [&_ul]:pl-5">
      <Markdown
        remarkPlugins={[remarkGfm]}
        components={{
          a: ({ href, children }) => (
            <a href={href} target="_blank" rel="noreferrer">
              {children}
            </a>
          ),
          table: ({ children }) =>
            wideTables ? (
              <WideTable>{children}</WideTable>
            ) : (
              <div className="overflow-x-auto">
                <table className={TABLE}>{children}</table>
              </div>
            ),
        }}
      >
        {text}
      </Markdown>
    </div>
  )
}
