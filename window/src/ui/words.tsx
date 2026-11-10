// Alpha's replies as the model writes them: Markdown, drawn as Claude Code draws it. No raw HTML.
// A table stays in the column, and scrolls sideways when it does not fit.
import { memo, type ReactNode, useEffect, useRef, useState } from 'react'
import Markdown, { type Components } from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { CopyButton } from './copy.tsx'

const TABLE =
  'w-full border-collapse text-md [&_td]:border-hair [&_td]:border-b [&_td]:px-3 [&_td]:py-1.5 [&_td]:align-top [&_th]:border-hair [&_th]:border-b [&_th]:bg-sunk [&_th]:px-3 [&_th]:py-1.5 [&_th]:text-left [&_th]:font-medium [&_th]:text-ink [&_tr:last-child_td]:border-b-0'

// A block of code: on its own ground, with Copy when the pointer is over it.
function Code({ children }: { children?: ReactNode }) {
  const box = useRef<HTMLPreElement>(null)
  return (
    <div className="group/code relative">
      <pre
        ref={box}
        className="overflow-x-auto rounded-lg border border-hair bg-sunk px-3.5 py-3 font-mono text-md leading-5"
      >
        {children}
      </pre>
      <CopyButton
        text={() => box.current?.innerText ?? ''}
        className="absolute top-1.5 right-1.5 opacity-0 transition-opacity group-hover/code:opacity-100"
      />
    </div>
  )
}

// Made once: new functions here on every draw would rebuild each table and code block as it streams.
const PARTS: Components = {
  // a place in Alpha opens in Alpha, beside the page where it can (opened.ts); anything
  // else in a new tab
  a: ({ href, children }) =>
    href?.startsWith('#/') ? (
      <a href={href}>{children}</a>
    ) : (
      <a href={href} target="_blank" rel="noreferrer">
        {children}
      </a>
    ),
  table: ({ children }) => (
    <div className="overflow-x-auto rounded-lg border border-hair">
      <table className={TABLE}>{children}</table>
    </div>
  ),
  pre: ({ children }) => <Code>{children}</Code>,
}

const PROSE =
  'flex min-w-0 flex-col gap-2.5 [&_a]:underline [&_a]:decoration-ink-3 [&_a]:underline-offset-2 [&_:not(pre)>code]:rounded [&_:not(pre)>code]:bg-hover [&_:not(pre)>code]:px-1 [&_:not(pre)>code]:py-px [&_:not(pre)>code]:font-mono [&_:not(pre)>code]:text-md [&_h1]:mt-3 [&_h1]:font-sans [&_h1]:font-semibold [&_h2]:mt-3 [&_h2]:font-sans [&_h2]:font-semibold [&_h3]:mt-3 [&_h3]:font-sans [&_h3]:font-semibold [&_h4]:mt-2 [&_h4]:font-sans [&_h4]:font-semibold [&_ul]:list-disc [&_ul]:pl-7.5 [&_ol]:list-decimal [&_ol]:pl-7.5 [&_li]:my-0.5 [&_li]:pl-2 [&_blockquote]:border-line [&_blockquote]:border-l-2 [&_blockquote]:pl-3 [&_blockquote]:text-ink-2 [&_hr]:border-hair [&_strong]:font-semibold'

export const Words = memo(function Words({ text }: { text: string }) {
  return (
    <div className={PROSE}>
      <Markdown remarkPlugins={[remarkGfm]} components={PARTS}>
        {text}
      </Markdown>
    </div>
  )
})

// A bold mark still waiting for its pair is not shown as two stars.
const steady = (t: string) =>
  (t.match(/\*\*/g)?.length ?? 0) % 2 ? t.replace(/\*\*(?!.*\*\*)/s, '') : t

// Text as it streams: however it arrives, it is shown a whole word at a time at a steady pace.
export function StreamedWords({ text, streaming }: { text: string; streaming: boolean }) {
  const [shown, setShown] = useState(streaming ? 0 : text.length)
  const at = useRef(shown)
  const goal = useRef(text)
  goal.current = text
  const running = useRef(false)
  useEffect(() => {
    if (running.current || at.current >= text.length) return
    running.current = true
    let last = 0
    let frame = requestAnimationFrame(function tick(now) {
      const t = goal.current
      const left = t.length - at.current
      if (left <= 0) {
        running.current = false
        return
      }
      if (now - last >= 30) {
        last = now
        const next = at.current + Math.max(3, Math.ceil(left / 14))
        const space = t.slice(next).search(/\s/)
        at.current = space < 0 ? t.length : next + space
        setShown(at.current)
      }
      frame = requestAnimationFrame(tick)
    })
    return () => {
      cancelAnimationFrame(frame)
      running.current = false
    }
  }, [text])
  return <Words text={steady(text.slice(0, shown))} />
}
