// The words a teammate's request and its answers reach an agent in: marked as a teammate's, so
// they are never taken for the person's own.
import type { AgentAsk } from '../world/agents/asks.ts'
import type { Card } from '../world/cards.ts'
import { type Task, whenSaid } from '../world/tasks/index.ts'

// What a desk is told when a card it raised is answered, and the line that says it carries on.
export const cardWords = (card: Card): string =>
  card.kind !== 'permission'
    ? `The person answered your question “${card.words}”: ${card.answer}`
    : card.state === 'yes'
      ? `The person said yes on the card: “${card.words}”. Go ahead with it now.`
      : `The person said no on the card: “${card.words}”. Leave it.`

export const carryingOn = (card: Card): string =>
  card.kind !== 'permission'
    ? 'Carrying on with your answer.'
    : `Carrying on after your ${card.state === 'yes' ? 'yes' : 'no'}.`

export function askText(ask: AgentAsk, fromName: string): string {
  const b = ask.brief
  if (b.direct)
    return [
      ...(b.known
        ? [
            `What came before this in their conversation with ${fromName}, word for word, as context and not a request:\n\n${b.known}`,
          ]
        : []),
      `They wrote this to you by name in that conversation, and your reply goes straight to them there:\n\n${b.objective}`,
    ].join('\n\n')
  return [
    `A request from your teammate ${fromName}. It is a teammate's request and not the person's own words.`,
    `Objective: ${b.objective}`,
    `What is known: ${b.known}`,
    `The answer wanted: ${b.answerWanted}`,
    `Limits: ${b.limits}`,
    'When you are done, call answer with the status, the result, the evidence and what would unblock it.',
  ].join('\n\n')
}

export function answersText(asks: AgentAsk[], names: (id: string) => string): string {
  const said = asks.map((a) =>
    a.answer
      ? [
          `## ${names(a.to)}: ${a.answer.status}`,
          a.answer.result,
          ...(a.answer.evidence ? [`Evidence: ${a.answer.evidence}`] : []),
          ...(a.answer.unblock ? [`What would unblock it: ${a.answer.unblock}`] : []),
        ].join('\n')
      : `## ${names(a.to)}: no answer (${a.state === 'unknown' ? 'whether it finished is not known; do not assume either way' : a.state})`,
  )
  return [
    "Your teammates answered. These are their words and not the person's, and what they say they did is their own report.",
    ...said,
    asks[0]?.parent
      ? 'Carry on with what you were doing.'
      : 'Carry on with what you were doing. What you wrote after asking was not shown to the person, so your reply now has to say all they need.',
  ].join('\n\n')
}

// What an agent is told when it is given a task: the task and where it sits, not the person's chat.
// What a scheduled run starts with: what to do, what its check found, how late it is and what it
// said last time.
export function scheduledText(s: {
  name: string
  when: string
  what: string
  found: unknown
  due: Date | null
  nowMs: number
  last: { at: string; words: string } | null
  person: string
}): string {
  const found =
    s.found === null || s.found === undefined
      ? null
      : typeof s.found === 'string'
        ? s.found
        : JSON.stringify(s.found, null, 1)
  const said = (ms: number) => whenSaid(new Date(ms).toISOString())
  return [
    `This is your scheduled work, ${s.name}, which runs ${s.when}. Nobody is waiting in this thread: work on it now, on your own.`,
    `What to do: ${s.what}`,
    ...(found ? [`What its check found:\n${found}`] : []),
    ...(s.due
      ? [
          `It came due at ${said(s.due.getTime())}, and it is now ${said(s.nowMs)}. If it is late, judge whether the work is still worth doing.`,
        ]
      : []),
    ...(s.last ? [`Last time (${whenSaid(s.last.at)}) you reported:\n${s.last.words}`] : []),
    `If there is nothing worth telling ${s.person} this time, call nothing_to_report and end your turn. Otherwise your last message is the report, so make it what they need to read.`,
  ].join('\n\n')
}

export function taskText(t: Task, place: string | null, giver: string): string {
  return [
    `${giver} has given you a task. Work on it now, on your own, and finish it.`,
    `Task: ${t.title}`,
    ...(t.notes ? [`Notes: ${t.notes}`] : []),
    ...(place ? [`It sits on: ${place}`] : []),
    ...(t.due ? [`Due: ${t.due}`] : []),
    'Your last message is the result, so make it what they need to read.',
  ].join('\n\n')
}
