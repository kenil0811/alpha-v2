// The act at Set up Alpha's foot, as a chapter sets it: its words, whether it can be pressed, its
// words while it works, and what it sends.
export interface Next {
  label: string
  ready: boolean
  busy?: string
  body?: () => unknown
}
