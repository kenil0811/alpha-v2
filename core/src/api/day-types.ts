// A person's day as Home reads it: the Next chip and the day beside the page. Re-exported by
// types.ts.

// A meeting that touches the day, from the person's own calendars.
export interface DayEventView {
  id: string
  table: string // the Calendar's Events, where the event opens as a row
  title: string
  starts: string // a moment, or a date for an all-day event
  ends: string | null
  allDay: boolean
  location: string | null
}

// An open task due that day.
export interface DayTaskView {
  id: string
  title: string
  due: string
  timed: boolean // due at a time, not only on the day
}

export interface DayView {
  calendar: string | null // the Calendar's Events table, where the day opens whole
  events: DayEventView[]
  tasks: DayTaskView[]
}
