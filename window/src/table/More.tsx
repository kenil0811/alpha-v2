// A table's ⋮ menu: the view's sort and group, the properties it shows, its layout, Add a property, Rename, Show as a tab, Read
// now on a table a connection fills, then Import and Export of exactly the rows and columns shown. Out of
// TableView.tsx so that screen only shrinks (the window file wall).
import type { FieldView, ReadByView, ViewConfig } from '@alpha/core/api'
import {
  ArrowDownUp,
  Ban,
  Columns3,
  Copy,
  EllipsisVertical,
  FileDown,
  FileSpreadsheet,
  FileText,
  FileUp,
  Group,
  ListChecks,
  PanelTop,
  PencilLine,
  Pin,
  Plus,
  RotateCcw,
  WrapText,
} from 'lucide-react'
import { useRef, useState } from 'react'
import { MenuItem, MenuLine, Popover, SubMenu } from '../ui/popover.tsx'
import { AddFieldForm } from './AddFieldForm.tsx'
import { setGroup } from './edits.ts'
import { canGroup } from './engine.ts'
import { ImportDialog } from './ImportDialog.tsx'
import { KindIcon } from './KindIcon.tsx'
import type { LayoutNow } from './layout.ts'
import { useShapeFixed } from './Mirror.tsx'
import { ReadNowItems } from './ReadNow.tsx'
import { SortEditor } from './SortEditor.tsx'
import { PropertyList } from './Toolbar.tsx'
import { NameForm } from './ViewTabs.tsx'

// The ⋮ menu: the view's sort and group, then Import and Export of exactly the rows and columns shown.
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
  mirror = null,
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
  readBy?: ReadByView[] // the connections that fill it
  name?: string | null // its name, where Rename on the menu may change it
  onRename?: (name: string) => void
  mirror?: string | null // the system a table a connection fills mirrors: its rows come from there
}) {
  const fixed = useShapeFixed()
  const [open, setOpen] = useState(false)
  const [add, setAdd] = useState(false)
  const [naming, setNaming] = useState(false)
  const [importing, setImporting] = useState(false)
  const grid = config.kind === 'table' ? undefined : 'Columns are laid out in the table view.'
  const wrapped = shown.length > 0 && shown.every((f) => layout.wrap.includes(f.id))
  const anchor = useRef<HTMLButtonElement>(null)
  const sortedBy = config.sorts
    .map((s) => fields.find((f) => f.id === s.field)?.name)
    .filter(Boolean)
  const grouped = fields.find((f) => f.id === config.group)
  const groupable = fields.filter(canGroup)
  return (
    <>
      <button
        ref={anchor}
        type="button"
        aria-label="More"
        data-tip="Sort, group, layout, import, export and more"
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
            <Ban className="size-3.5 text-ink-3" />
            No grouping
          </MenuItem>
          <MenuLine />
          {groupable.map((f) => (
            <MenuItem
              key={f.id}
              checked={f.id === config.group}
              onClick={() => onConfig(setGroup(config, f.id))}
            >
              <KindIcon field={f} />
              {f.name}
            </MenuItem>
          ))}
        </SubMenu>
        <SubMenu
          label={
            <>
              <ListChecks className="size-3.5 text-ink-3" />
              Properties
            </>
          }
          hint={config.hidden.length ? `${config.hidden.length} hidden` : 'All shown'}
        >
          <PropertyList fields={fields} config={config} onConfig={onConfig} />
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
              <Pin className="size-3.5 text-ink-3" />
              {n === 1 ? 'Freeze the first column' : `Freeze the first ${n} columns`}
            </MenuItem>
          ))}
          <MenuLine />
          <MenuItem
            checked={wrapped}
            onClick={() => layout.setWrap(wrapped ? [] : shown.map((f) => f.id))}
          >
            <WrapText className="size-3.5 text-ink-3" />
            Wrap text in every column
          </MenuItem>
          <MenuItem
            reason={
              Object.keys(config.widths).length ? undefined : 'The columns are at their own widths.'
            }
            onClick={() => onConfig({ ...config, widths: {} })}
          >
            <RotateCcw className="size-3.5 text-ink-3" />
            Reset the column widths
          </MenuItem>
        </SubMenu>
        <MenuItem
          reason={
            fixed ?? (adding ? undefined : 'This list has its own page; add properties there.')
          }
          onClick={() => {
            setOpen(false)
            setAdd(true)
          }}
        >
          <Plus className="size-3.5 text-ink-3" />
          Add a property
        </MenuItem>
        <MenuItem
          // rows go in as they do by hand: not into a mirror, and a managed module takes them
          reason={
            mirror
              ? `Its rows come from ${mirror}.`
              : adding
                ? undefined
                : 'This table has its own page; import there.'
          }
          onClick={() => {
            setOpen(false)
            setImporting(true)
          }}
        >
          <FileUp className="size-3.5 text-ink-3" />
          Import
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
            <PanelTop className="size-3.5 text-ink-3" />
            Show as a tab
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
              <FileDown className="size-3.5 text-ink-3" />
              Export
            </>
          }
        >
          <MenuItem
            onClick={() => {
              setOpen(false)
              onExport('xlsx')
            }}
          >
            <FileSpreadsheet className="size-3.5 text-ink-3" />
            Excel, as shown
          </MenuItem>
          <MenuItem
            onClick={() => {
              setOpen(false)
              onExport('csv')
            }}
          >
            <FileText className="size-3.5 text-ink-3" />
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
      {importing && (
        <ImportDialog tableId={tableId} fields={fields} onClose={() => setImporting(false)} />
      )}
      <Popover anchor={anchor} open={add} onClose={() => setAdd(false)} align="end">
        <AddFieldForm tableId={tableId} title="Add a property" onAdded={() => setAdd(false)} />
      </Popover>
    </>
  )
}
