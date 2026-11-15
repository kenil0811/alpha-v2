// A field's kind as a small icon: what stands at the left of a field's name in a menu.
import type { FieldView } from '@alpha/core/api'
import {
  Calendar,
  ChevronsUpDown,
  CircleDollarSign,
  Hash,
  Link,
  type LucideIcon,
  Mail,
  Paperclip,
  Phone,
  Sigma,
  StickyNote,
  Tags,
  Type,
  User,
  Waypoints,
} from 'lucide-react'

const ICONS: Record<string, LucideIcon> = {
  text: Type,
  number: Hash,
  money: CircleDollarSign,
  date: Calendar,
  choice: ChevronsUpDown,
  relation: Waypoints,
  person: User,
  file: Paperclip,
  link: Link,
  email: Mail,
  phone: Phone,
  notes: StickyNote,
  summary: Sigma,
}

export function KindIcon({ field }: { field: Pick<FieldView, 'kind' | 'many'> }) {
  const Icon = field.kind === 'choice' && field.many ? Tags : (ICONS[field.kind] ?? Type)
  return <Icon className="size-3.5 shrink-0 text-ink-3" />
}
