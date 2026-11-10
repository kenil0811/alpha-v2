// One icon set for modules: the rail, the folded rail and Home's cards draw a module's icon from
// here and nowhere else. A name that says what the module is picks its icon; any other name gets
// one of the set, the same one every time.
import {
  BookOpen,
  Boxes,
  Briefcase,
  Calculator,
  CalendarDays,
  ChartLine,
  FileText,
  Handshake,
  Landmark,
  Megaphone,
  Package,
  Receipt,
  ShoppingCart,
  Sparkles,
  Truck,
  Users,
  Wrench,
} from 'lucide-react'
import type { ComponentType } from 'react'

type Icon = ComponentType<{ className?: string | undefined }>

const BY_WORD: [RegExp, Icon][] = [
  [/network|people|contact|client|customer|crm/i, Users],
  [/deal|sales|pipeline|lead/i, Handshake],
  [/invoice|bill|receipt/i, Receipt],
  [/account|ledger|book ?keep|finance|tax/i, Calculator],
  [/bank|loan|fund/i, Landmark],
  [/order|shop|store/i, ShoppingCart],
  [/stock|inventory|product/i, Package],
  [/ship|deliver|logistic/i, Truck],
  [/market|campaign|social/i, Megaphone],
  [/report|metric|dashboard|analytic/i, ChartLine],
  [/calendar|schedule|booking/i, CalendarDays],
  [/doc|contract|file/i, FileText],
  [/repair|service|maintenance|job/i, Wrench],
  [/learn|course|training|note/i, BookOpen],
  [/^alpha$/i, Sparkles],
]
const REST: Icon[] = [Briefcase, Boxes, BookOpen, ChartLine, FileText, Package]

export function ModuleIcon({ name, className }: { name: string; className?: string }) {
  const Found =
    BY_WORD.find(([words]) => words.test(name))?.[1] ??
    REST[[...name].reduce((n, c) => n + c.charCodeAt(0), 0) % REST.length] ??
    Briefcase
  return <Found className={className} />
}
