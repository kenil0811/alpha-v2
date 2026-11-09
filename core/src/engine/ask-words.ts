// The words a teammate's request and its answers reach an agent in: marked as a teammate's, so
// they are never taken for the person's own.
import type { AgentAsk } from '../world/agents/asks.ts'
import type { Card } from '../world/cards.ts'

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
