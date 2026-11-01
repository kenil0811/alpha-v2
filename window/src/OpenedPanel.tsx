// A task, a run, a person or a row open beside the page (Batch A, pick 2, Kenil's yes 1 Nov): its
// own page, narrow, in the side panel, with Open page to the page itself. A link to one of them
// opens it here when the window has room beside the page (room.ts); a ⌘-click, Open page, or no
// room goes to the page, as before.
import { useEffect, useState } from 'react'
import { ItemPage } from './Items.tsx'
import { linkBeside, type Opened, pageOf, splitBeside, withBeside } from './opened.ts'
import { People } from './People.tsx'
import { RowPage } from './RowPage.tsx'
import { BarMiddle } from './Shell.tsx'
import { Tasks } from './Tasks.tsx'
import { SidePanel } from './ui/side-panel.tsx'

// A click on a link to one of the four kinds opens it beside the page, in the address.
export function useOpenBeside(room: boolean): void {
  useEffect(() => {
    if (!room) return
    const click = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey) return
      const a = (e.target as Element | null)?.closest?.('a[href]')
      const href = a?.getAttribute('href')
      if (!href) return
      const { base } = splitBeside(window.location.hash)
      const opened = linkBeside(href, base)
      if (!opened) return
      e.preventDefault()
      window.location.hash = withBeside(base, opened)
    }
    document.addEventListener('click', click)
    return () => document.removeEventListener('click', click)
  }, [room])
}

export function OpenedPanel({
  opened,
  version,
  width: start,
  onClose,
}: {
  opened: Opened
  version: number
  width: number // where it starts (room.ts besideWidth); the person may drag it
  onClose: () => void
}) {
  const [name, setName] = useState('')
  const [width, setWidth] = useState<number | null>(start)
  useEffect(() => setName(''), [opened.kind, opened.id])
  const page =
    opened.kind === 'row' ? (
      <RowPage id={opened.id} version={version} onPlace={(p) => setName(p?.title ?? '')} />
    ) : opened.kind === 'task' ? (
      <Tasks list="open" id={opened.id} version={version} onName={setName} />
    ) : opened.kind === 'run' ? (
      <ItemPage kind="run" id={opened.id} version={version} onName={setName} />
    ) : (
      <People kind="person" id={opened.id} version={version} net={null} onName={setName} />
    )
  return (
    <SidePanel
      title={name || '…'}
      onClose={onClose}
      full={pageOf(opened)}
      width={width}
      onWidth={setWidth}
    >
      {/* the page's switch stays in the window's bar: nothing here reaches it */}
      <BarMiddle value={null}>
        <div key={`${opened.kind}/${opened.id}`} className="h-full">
          {page}
        </div>
      </BarMiddle>
    </SidePanel>
  )
}
