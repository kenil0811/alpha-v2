// A picture or a file the core keeps, fetched with the token in its header and shown from a blob
// address, so the token is never in an address a link, a picture or history would show. A picture
// opens full size in a dialog (the Mac window sends a new window to the browser, where a blob is
// not there); a file is saved, as an export is.
import { type ImgHTMLAttributes, useEffect, useState } from 'react'
import { api } from '../api.ts'
import { Dialog } from './dialog.tsx'

// The blob address of a core path while it is shown; none until it is here, or with no path.
export function useCoreFile(path: string | null): string | undefined {
  const [url, setUrl] = useState<string>()
  useEffect(() => {
    if (!path) return
    let gone = false
    let made: string | undefined
    api.blob(path).then(
      (b) => {
        if (gone) return
        made = URL.createObjectURL(b)
        setUrl(made)
      },
      () => undefined,
    )
    return () => {
      gone = true
      setUrl(undefined)
      if (made) URL.revokeObjectURL(made)
    }
  }, [path])
  return url
}

export function CoreImage({
  path,
  alt,
  ...img
}: { path: string; alt: string } & Omit<ImgHTMLAttributes<HTMLImageElement>, 'src' | 'alt'>) {
  const src = useCoreFile(path)
  return src ? <img src={src} alt={alt} {...img} /> : null
}

// A picture the core keeps: a click shows it full size.
export function CorePicture({
  path,
  alt,
  className,
  boxClassName,
}: {
  path: string
  alt: string
  className?: string
  boxClassName?: string
}) {
  const src = useCoreFile(path)
  const [open, setOpen] = useState(false)
  if (!src) return null
  return (
    <>
      <button
        type="button"
        data-tip="See it full size"
        className={boxClassName}
        onClick={() => setOpen(true)}
      >
        <img src={src} alt={alt} className={className} />
      </button>
      <Dialog open={open} title={alt} wide onClose={() => setOpen(false)}>
        <img src={src} alt={alt} className="block max-h-[75dvh] w-auto max-w-full" />
      </Dialog>
    </>
  )
}

// A file the core keeps, saved under its own name.
export async function saveCoreFile(path: string, name: string): Promise<void> {
  const url = URL.createObjectURL(await api.blob(path))
  const a = document.createElement('a')
  a.href = url
  a.download = name
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}
