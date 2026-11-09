// Alpha's replies as the model writes them: Markdown, drawn in the kit's thin look. No raw HTML.
// A table stays in the column, and scrolls sideways when it does not fit.
import Markdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

const TABLE =
  'w-fit border-collapse text-base [&_td]:border-b [&_td]:border-hair [&_td]:px-2 [&_td]:py-1 [&_th]:border-b [&_th]:border-line [&_th]:px-2 [&_th]:py-1 [&_th]:text-left [&_th]:font-normal [&_th]:text-ink-2'

export function Words({ text }: { text: string }) {
  return (
    <div className="flex flex-col gap-3 leading-relaxed [&_a]:underline [&_code]:rounded [&_code]:bg-sunk [&_code]:px-1 [&_code]:text-md [&_ol]:list-decimal [&_ol]:pl-5 [&_h1]:font-medium [&_h1]:font-serif [&_h1]:text-xl [&_h2]:font-medium [&_h2]:text-lg [&_h3]:font-semibold [&_strong]:font-medium [&_ul]:list-disc [&_ul]:pl-5">
      <Markdown
        remarkPlugins={[remarkGfm]}
        components={{
          // a place in Alpha opens in Alpha, beside the page where it can (opened.ts); anything
          // else in a new tab (Batch D, 66.13, Kenil's yes 2 Nov)
          a: ({ href, children }) =>
            href?.startsWith('#/') ? (
              <a href={href}>{children}</a>
            ) : (
              <a href={href} target="_blank" rel="noreferrer">
                {children}
              </a>
            ),
          table: ({ children }) => (
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
