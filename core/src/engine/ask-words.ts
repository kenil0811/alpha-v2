// The words a teammate's request and its answers reach an agent in: marked as a teammate's, so
// they are never taken for the person's own.
import type { AgentAsk } from '../world/agents/asks.ts'

export function askText(ask: AgentAsk, fromName: string): string {
  const b = ask.brief
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
    'Carry on with what you were doing.',
  ].join('\n\n')
}
