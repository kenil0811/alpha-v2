// Where files are added, the same everywhere (Vikas, 27 Oct): a dashed box to drop them on, or a
// click to choose them; what is already there sits inside it.
import { Upload } from 'lucide-react'
import { type ReactNode, useRef, useState } from 'react'
import { cn } from './cn.ts'

export function DropZone({
  onFiles,
  busy = false,
  accept,
  children,
}: {
  onFiles: (files: FileList) => void
  busy?: boolean
  accept?: string // one file of this kind, like ".alphakit"; files of any kind when left out
  children?: ReactNode // the files already there; none, and the box says how to add one
}) {
  const [over, setOver] = useState(false)
  const picker = useRef<HTMLInputElement>(null)
  const choose = (
    <button
      type="button"
      onClick={() => picker.current?.click()}
      className={cn(
        'flex w-full items-center justify-center gap-1.5 text-ink-3 text-sm hover:text-accent',
        children ? 'pt-1.5' : 'flex-col py-4',
      )}
    >
      <Upload className={children ? 'size-3.5' : 'size-5'} />
      {busy
        ? 'Adding…'
        : accept
          ? `Drop a ${accept} file here, or click to choose`
          : 'Drop files here, or click to choose'}
    </button>
  )
  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: a drop target; the button inside is the keyboard way
    <div
      onDragOver={(e) => {
        e.preventDefault()
        setOver(true)
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault()
        e.stopPropagation()
        setOver(false)
        onFiles(e.dataTransfer.files)
      }}
      className={cn(
        'rounded-md border border-dashed p-1.5',
        over ? 'border-accent bg-accent-soft' : 'border-line',
      )}
    >
      {children}
      {choose}
      <input
        ref={picker}
        type="file"
        multiple={!accept}
        accept={accept}
        className="hidden"
        onChange={(e) => {
          if (e.target.files) onFiles(e.target.files)
          e.target.value = ''
        }}
      />
    </div>
  )
}
