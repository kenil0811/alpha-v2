// One place to add files: a dashed box to drop them on or click to choose them, what is already
// there inside it. A row's files first; the other places that take a drop (the conversation, the
// grid, a board, the window) share `dropped` below, not the box.
import { Upload } from 'lucide-react'
import { Children, type DragEvent, type ReactNode, useRef, useState } from 'react'
import { cn } from './cn.ts'

// The files a drop brought, or none when it brought none (text, a link).
export const dropped = (e: DragEvent): File[] => [...(e.dataTransfer?.files ?? [])]
export const carriesFiles = (e: DragEvent) => [...(e.dataTransfer?.types ?? [])].includes('Files')

export function DropZone({
  onFiles,
  busy = false,
  children,
}: {
  onFiles: (files: File[]) => void
  busy?: boolean
  children?: ReactNode // the files already there
}) {
  const [over, setOver] = useState(false)
  const pick = useRef<HTMLInputElement>(null)
  const has = Children.toArray(children).length > 0
  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: a place to drop; the button inside is the keyboard's way
    <div
      onDragOver={(e) => {
        if (!carriesFiles(e)) return
        e.preventDefault()
        setOver(true)
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        const files = dropped(e)
        setOver(false)
        if (!files.length) return
        e.preventDefault()
        e.stopPropagation() // the window's own drop does not take it too
        onFiles(files)
      }}
      className={cn(
        'flex flex-col gap-1 rounded-md border border-dashed p-1.5 transition-colors',
        over ? 'border-accent bg-accent-soft' : 'border-line',
      )}
    >
      {children}
      <button
        type="button"
        disabled={busy}
        onClick={() => pick.current?.click()}
        className={cn(
          'flex w-full items-center justify-center gap-1.5 rounded-sm text-ink-3 text-sm hover:text-accent',
          has ? 'py-1' : 'flex-col py-4',
        )}
      >
        <Upload className={has ? 'size-3.5' : 'size-5'} />
        {busy ? 'Adding…' : 'Drop files here, or click to choose'}
      </button>
      <input
        ref={pick}
        type="file"
        multiple
        className="hidden"
        onChange={(e) => {
          if (e.target.files?.length) onFiles([...e.target.files])
          e.target.value = ''
        }}
      />
    </div>
  )
}
