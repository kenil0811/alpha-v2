// Alpha's replies as the model writes them: Markdown, drawn in the kit's thin look. No raw HTML.
import Markdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

export function Words({ text }: { text: string }) {
  return (
    <div className="flex flex-col gap-3 leading-relaxed [&_a]:underline [&_code]:rounded [&_code]:bg-neutral-100 [&_code]:px-1 [&_code]:text-[13px] [&_ol]:list-decimal [&_ol]:pl-5 [&_strong]:font-medium [&_ul]:list-disc [&_ul]:pl-5">
      <Markdown
        remarkPlugins={[remarkGfm]}
        components={{
          a: ({ href, children }) => (
            <a href={href} target="_blank" rel="noreferrer">
              {children}
            </a>
          ),
          table: ({ children }) => (
            <table className="w-fit border-collapse text-sm [&_td]:border-b [&_td]:border-neutral-100 [&_td]:px-2 [&_td]:py-1 [&_th]:border-b [&_th]:border-neutral-200 [&_th]:px-2 [&_th]:py-1 [&_th]:text-left [&_th]:font-normal [&_th]:text-neutral-500">
              {children}
            </table>
          ),
        }}
      >
        {text}
      </Markdown>
    </div>
  )
}
