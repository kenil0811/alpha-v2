// The message box at the foot of a conversation (split from Conversation.tsx for its wall): files
// and a folder on its +, and @ to pick teammates, whose ids travel with the message.
import type { AgentView } from '@alpha/core/api'
import { ArrowUp, Bot, FolderUp, ImageUp, Plus, Square } from 'lucide-react'
import { type KeyboardEvent, type RefObject, useLayoutEffect, useRef, useState } from 'react'
import { ModelPicker } from './Agents.tsx'
import { api, Problem } from './api.ts'
import type { Module } from './stream.ts'
import { IconButton } from './ui/button.tsx'
import { cn } from './ui/cn.ts'
import { MenuItem, Popover } from './ui/popover.tsx'

// The words before the caret that address a teammate: "@" at the start or after a space, then a name.
export function mentionAt(text: string): string | null {
  const m = /(?:^|\s)@([^@\n]*)$/.exec(text)
  return m ? (m[1] ?? '') : null
}

export function Composer({
  words,
  setWords,
  area,
  onProblem,
  from,
  agent,
  agents,
  running,
}: {
  words: string
  setWords: (w: string) => void
  area: RefObject<HTMLTextAreaElement | null>
  onProblem: (p: string) => void
  from: Module
  agent: AgentView | null
  agents: AgentView[]
  running: boolean // the agent is working: an empty box's button is Stop
}) {
  // the box grows with what is typed, up to its most, then scrolls
  useLayoutEffect(() => {
    const el = area.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${el.scrollHeight}px`
  }, [words, area])
  const file = useRef<HTMLInputElement>(null)
  const folder = useRef<HTMLInputElement>(null)
  const plus = useRef<HTMLButtonElement>(null)
  // the + menu; its keys are the shared menu's (ui/popover.tsx)
  const [open, setOpen] = useState(false)
  const close = () => setOpen(false)
  const add = async (files: FileList | null) => {
    for (const f of Array.from(files ?? []))
      await api.upload(f).catch(() => onProblem(`${f.name} did not go in.`))
  }
  // "@" picks teammates; the picks travel with the message as ids
  const [query, setQuery] = useState<string | null>(null)
  const [pick, setPick] = useState(0)
  const [picked, setPicked] = useState<AgentView[]>([])
  const shown =
    query === null
      ? []
      : agents
          .filter((a) => a.id !== (agent?.id ?? 'chief'))
          .filter((a) => a.name.toLowerCase().startsWith(query.toLowerCase()))
          .slice(0, 6)
  const type = (w: string, caret: number) => {
    setWords(w)
    setQuery(mentionAt(w.slice(0, caret)))
    setPick(0)
  }
  const choose = (a: AgentView) => {
    const caret = area.current?.selectionStart ?? words.length
    const before = words.slice(0, caret).replace(/@[^@\n]*$/, `@${a.name} `)
    setWords(before + words.slice(caret))
    setPicked((p) => [...p, a])
    setQuery(null)
    requestAnimationFrame(() => area.current?.setSelectionRange(before.length, before.length))
  }
  const send = async () => {
    const w = words.trim()
    if (!w) return
    setWords('')
    setQuery(null)
    // a pick whose name was deleted from the words is no pick
    const named = picked.filter((a) => w.includes(`@${a.name}`)).map((a) => a.id)
    setPicked([])
    try {
      await api.post('/api/say', {
        words: w,
        ...(from ? { from: from.id } : {}),
        ...(agent && !agent.chief ? { agent: agent.id } : {}),
        ...(named.length ? { named } : {}),
      })
    } catch (err) {
      setWords(w)
      onProblem(err instanceof Problem ? err.message : 'That did not reach Alpha.')
    }
  }
  const key = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (shown.length) {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault()
        const step = e.key === 'ArrowDown' ? 1 : shown.length - 1
        setPick((p) => (p + step) % shown.length)
        return
      }
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault()
        const a = shown[pick]
        if (a) choose(a)
        return
      }
      if (e.key === 'Escape') {
        e.preventDefault() // App's Escape would fold the assistant too
        setQuery(null)
        return
      }
    }
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault()
      void send()
    }
  }
  return (
    <div className="flex flex-col gap-1.5">
      <div className="relative flex items-end gap-1.5 rounded-xl border border-line bg-surface px-2 py-1.5 focus-within:border-accent-line">
        {shown.length > 0 && (
          <div
            role="listbox"
            aria-label="Teammates"
            className="absolute inset-x-3 bottom-full z-(--z-raised) mb-2 flex flex-col overflow-hidden rounded-lg border border-line bg-surface shadow-pop"
          >
            {shown.map((a, i) => (
              <button
                key={a.id}
                type="button"
                role="option"
                aria-selected={i === pick}
                onMouseDown={(e) => e.preventDefault()} // the composer keeps the caret
                onClick={() => choose(a)}
                className={cn(
                  'flex items-center gap-2 px-3 py-1.5 text-left text-ink text-md',
                  i === pick ? 'bg-hover' : 'hover:bg-hover',
                )}
              >
                <Bot className="size-3.5 shrink-0 text-ink-3" />
                {a.name}
                <span className="truncate text-ink-3 text-sm">{a.title}</span>
              </button>
            ))}
          </div>
        )}
        <IconButton
          ref={plus}
          label="Add files and more"
          className="rounded-full"
          aria-haspopup="menu"
          aria-expanded={open}
          onClick={() => setOpen(!open)}
        >
          <Plus className="size-4" />
        </IconButton>
        <Popover anchor={plus} open={open} onClose={close}>
          <MenuItem
            onClick={() => {
              close()
              file.current?.click()
            }}
          >
            <ImageUp className="size-3.5 text-ink-3" />
            Add files or images
          </MenuItem>
          <MenuItem
            onClick={() => {
              close()
              folder.current?.click()
            }}
          >
            <FolderUp className="size-3.5 text-ink-3" />
            Add a folder
          </MenuItem>
        </Popover>
        <input
          ref={file}
          type="file"
          multiple
          hidden
          onChange={async (e) => {
            await add(e.target.files)
            e.target.value = ''
          }}
        />
        <input
          ref={folder}
          type="file"
          hidden
          {...{ webkitdirectory: '' }}
          onChange={async (e) => {
            await add(e.target.files)
            e.target.value = ''
          }}
        />
        <textarea
          ref={area}
          rows={1}
          value={words}
          onChange={(e) => type(e.target.value, e.target.selectionStart)}
          onBlur={() => setQuery(null)}
          onKeyDown={key}
          placeholder={`Message ${agent?.name ?? 'Chief of staff'}`}
          aria-label={`Message ${agent?.name ?? 'Chief of staff'}`}
          className="max-h-40 min-h-7 min-w-0 flex-1 resize-none self-center overflow-y-auto bg-transparent py-0.75 text-chat text-ink outline-none placeholder:text-ink-3"
        />
        {running && !words.trim() ? (
          <button
            type="button"
            aria-label="Stop"
            data-tip="Stop"
            onClick={() => void api.post('/api/stop', { agent: agent?.id ?? 'chief' })}
            className="grid size-8 shrink-0 place-items-center rounded-lg bg-accent text-accent-ink"
          >
            <Square className="size-3 fill-current" />
          </button>
        ) : (
          <button
            type="button"
            aria-label="Send"
            data-tip="Send"
            onClick={send}
            disabled={!words.trim()}
            className="grid size-8 shrink-0 place-items-center rounded-lg bg-accent text-accent-ink transition-opacity disabled:opacity-35"
          >
            <ArrowUp className="size-4" />
          </button>
        )}
      </div>
      <div className="flex min-h-6 items-center justify-between gap-3 px-2">
        <span className="flex min-w-0 items-center gap-2 text-ink-3 text-sm">
          {running && (
            <>
              <span className="size-3 shrink-0 animate-spin rounded-full border-2 border-accent-line border-t-ink-3" />
              Working on it…
            </>
          )}
        </span>
        {agent && <ModelPicker agent={agent} />}
      </div>
    </div>
  )
}
