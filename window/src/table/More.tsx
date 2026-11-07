// A table's ⋮ menu: the view's sort and group, its layout, Add column, Rename, Keep as a tab, Read
// now on a table a connection fills (Batch B, pick 15), then downloads of exactly the rows and
// columns shown. Out of TableView.tsx so that screen only shrinks (the window file wall).
import type { FieldView, ReadByView, ViewConfig } from '@alpha/core/api'
import {
  ArrowDownUp,
  Columns3,
  Copy,
  Download,
  EllipsisVertical,
  Group,
  PencilLine,
  Plus,
} from 'lucide-react'
import { useRef, useState } from 'react'
import { MenuItem, MenuLine, Popover, SubMenu } from '../ui/popover.tsx'
import { setGroup } from './edits.ts'
import { GROUPABLE } from './engine.ts'
import { AddFieldForm } from './Grid.tsx'
import type { LayoutNow } from './layout.ts'
import { useShapeFixed } from './Mirror.tsx'
import { ReadNowItems } from './ReadNow.tsx'
import { SortEditor } from './SortEditor.tsx'
import { NameForm } from './ViewTabs.tsx'
import { isTags } from './values.ts'

// The ⋮ menu: the view's sort and group, then downloads of exactly the rows and columns shown.
export function More({
  tableId,
  fields,
  shown,
  config,
  layout,
  adding,
  onConfig,
  onExport,
  onCopy,
  tab = null,
  onTab,
  readBy = [],
  name = null,
  onRename,
}: {
  tableId: string
  fields: FieldView[]
  shown: FieldView[]
  config: ViewConfig
  layout: LayoutNow
  adding: boolean // whether a column can be added here
  onConfig: (c: ViewConfig) => void
  onExport: (as: 'csv' | 'xlsx') => void
  onCopy: () => void
  tab?: boolean | null // a part or setup table: whether it is kept as a tab; null for the rest
  onTab?: (tab: boolean) => void
  readBy?: ReadByView[] // the connections that fill it (Batch B, pick 15)
  name?: string | null // its name, where Rename may change it (Kenil's call, 7 Nov: on the menu)
  onRename?: (name: string) => void
}) {
  const fixed = useShapeFixed()
  const [open, setOpen] = useState(false)
  const [add, setAdd] = useState(false)
  const [naming, setNaming] = useState(false)
  const grid = config.kind === 'table' ? undefined : 'Columns are laid out in the table view.'
  const wrapped = shown.length > 0 && shown.every((f) => layout.wrap.includes(f.id))
  const anchor = useRef<HTMLButtonElement>(null)
  const sortedBy = config.sorts
    .map((s) => fields.find((f) => f.id === s.field)?.name)
    .filter(Boolean)
  const grouped = fields.find((f) => f.id === config.group)
  const groupable = fields.filter((f) => GROUPABLE.has(f.kind) && !isTags(f))
  return (
    <>
      <button
        ref={anchor}
        type="button"
        aria-label="More"
        data-tip="Sort, group, layout, download and more"
        onClick={() => setOpen((o) => !o)}
        className="grid size-7.5 shrink-0 place-items-center rounded-md text-ink-2 hover:bg-hover hover:text-ink"
      >
        <EllipsisVertical className="size-4" />
      </button>
      <Popover anchor={anchor} open={open} onClose={() => setOpen(false)} align="end">
        <SubMenu
          label={
            <>
              <ArrowDownUp className="size-3.5 text-ink-3" />
              Sort
            </>
          }
          hint={sortedBy.length ? sortedBy.join(', ') : 'None'}
        >
          <SortEditor fields={fields} config={config} onConfig={onConfig} />
        </SubMenu>
        <SubMenu
          label={
            <>
              <Group className="size-3.5 text-ink-3" />
              Group
            </>
          }
          hint={grouped?.name ?? 'None'}
          reason={
            config.kind === 'table' || config.kind === 'list'
              ? groupable.length
                ? undefined
                : 'No column here can be grouped by.'
              : 'Groups show in the table and list views.'
          }
        >
          <MenuItem checked={!grouped} onClick={() => onConfig(setGroup(config, null))}>
            No grouping
          </MenuItem>
          <MenuLine />
          {groupable.map((f) => (
            <MenuItem
              key={f.id}
              checked={f.id === config.group}
              onClick={() => onConfig(setGroup(config, f.id))}
            >
              {f.name}
            </MenuItem>
          ))}
        </SubMenu>
        <SubMenu
          label={
            <>
              <Columns3 className="size-3.5 text-ink-3" />
              Layout
            </>
          }
          reason={grid}
        >
          {[1, 2, 3].map((n) => (
            <MenuItem
              key={n}
              checked={layout.frozen === n}
              reason={n > shown.length ? `There are only ${shown.length} columns.` : undefined}
              onClick={() => layout.setFrozen(n)}
            >
              {n === 1 ? 'Freeze the first column' : `Freeze the first ${n} columns`}
            </MenuItem>
          ))}
          <MenuLine />
          <MenuItem
            checked={wrapped}
            onClick={() => layout.setWrap(wrapped ? [] : shown.map((f) => f.id))}
          >
            Wrap text in every column
          </MenuItem>
          <MenuItem
            reason={
              Object.keys(config.widths).length ? undefined : 'The columns are at their own widths.'
            }
            onClick={() => onConfig({ ...config, widths: {} })}
          >
            Reset the column widths
          </MenuItem>
        </SubMenu>
        <MenuItem
          reason={
            fixed ?? (adding ? undefined : 'This table is kept on its own page; add columns there.')
          }
          onClick={() => {
            setOpen(false)
            setAdd(true)
          }}
        >
          <Plus className="size-3.5 text-ink-3" />
          Add column
        </MenuItem>
        {name !== null && (
          <MenuItem
            reason={fixed}
            onClick={() => {
              setOpen(false)
              setNaming(true)
            }}
          >
            <PencilLine className="size-3.5 text-ink-3" />
            Rename
          </MenuItem>
        )}
        {tab !== null && (
          <MenuItem
            checked={tab}
            onClick={() => {
              setOpen(false)
              onTab?.(!tab)
            }}
          >
            Keep as a tab
          </MenuItem>
        )}
        {readBy.length > 0 && (
          <>
            <MenuLine />
            <ReadNowItems tableId={tableId} readBy={readBy} onDone={() => setOpen(false)} />
          </>
        )}
        <MenuLine />
        <SubMenu
          label={
            <>
              <Download className="size-3.5 text-ink-3" />
              Download
            </>
          }
        >
          <MenuItem
            onClick={() => {
              setOpen(false)
              onExport('xlsx')
            }}
          >
            Excel, as shown
          </MenuItem>
          <MenuItem
            onClick={() => {
              setOpen(false)
              onExport('csv')
            }}
          >
            CSV, as shown
          </MenuItem>
          <MenuLine />
          <MenuItem
            onClick={() => {
              setOpen(false)
              onCopy()
            }}
          >
            <Copy className="size-3.5 text-ink-3" />
            Copy as a table
          </MenuItem>
        </SubMenu>
      </Popover>
      <Popover anchor={anchor} open={naming} onClose={() => setNaming(false)} align="end">
        <NameForm
          start={name ?? ''}
          label="Rename"
          about="The table’s name"
          onSave={(to) => {
            setNaming(false)
            onRename?.(to)
          }}
        />
      </Popover>
      <Popover anchor={anchor} open={add} onClose={() => setAdd(false)} align="end">
        <AddFieldForm tableId={tableId} title="Add a column" onAdded={() => setAdd(false)} />
      </Popover>
    </>
  )
}
