// Interviews (the onboarding plan of 18 Nov, redesigned 22 Nov): the Interviewer, an agent this
// plugin's kit carries, gets to know each person here from what they let it read and what they
// answer, and keeps a report of their work in its module, Your work: their workflows, each one's
// steps, and what Alpha could build for it. It does so in three steps of Set up Alpha, What I
// learned, A few questions and Off your plate, drawn by code; its tools stay for going over the report in its
// chat. On only in an Alpha whose alpha.yaml names it (rules P1). Everything it does goes through
// the plugin host, and removing this folder removes it whole; what it made stays as an ordinary
// module.
import type { Plugin } from '@alpha/plugin-sdk'
import { settleStories } from './know.ts'
import { LearnedBody, learnedAct, learnedScreen } from './learned.ts'
import { proposeTool } from './propose.ts'
import { shortTool } from './short.ts'
import { sourceTool } from './source.ts'

export const plugin: Plugin = {
  name: 'interviews',
  title: 'Interviews',
  kit: 'kit',
  register(host) {
    settleStories(host)
    host.tools('interviewer', [sourceTool(host), proposeTool(host), shortTool(host)])
    // What I learned, A few questions and Off your plate, after Invite team; what is connected is
    // read as they are drawn, so there is no step for allowing it
    const steps = [
      ['learned', 'What I learned'],
      ['questions', 'A few questions'],
      ['plate', 'Off your plate'],
    ] as const
    for (const [key, title] of steps)
      host.chapter({
        key,
        title,
        after: 'people',
        who: 'everyone',
        screen: async ({ person }) => learnedScreen(host, person, key),
        act: async ({ person, body }) =>
          learnedAct(host, person, LearnedBody.parse(body ?? {}), key),
      })
  },
}
