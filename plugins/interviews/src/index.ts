// Interviews (the onboarding plan of 18 Nov, redesigned 22 Nov): the Interviewer, an agent this
// plugin's kit carries, gets to know each person here from what they let it read and what they
// answer, and keeps a report of their work in its module, Your work: their workflows, each one's
// steps, and what Alpha could build for it. It does so in two chapters of Set up Alpha, Get to
// know you and What I learned, drawn by code; its tools stay for going over the report in its
// chat. On only in an Alpha whose alpha.yaml names it (rules P1). Everything it does goes through
// the plugin host, and removing this folder removes it whole; what it made stays as an ordinary
// module.
import type { Plugin } from '@alpha/plugin-sdk'
import { think } from './draft.ts'
import { KnowBody, keptReading, knowScreen, readAll, settleStories } from './know.ts'
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
    // after setup, Browsing and Apps read every day for what the person switched on (23 Nov)
    host.keepsReading((person) => keptReading(host, person))
    host.tools('interviewer', [sourceTool(host), proposeTool(host), shortTool(host)])
    host.chapter({
      key: 'know',
      title: 'Get to know you',
      after: 'connect',
      who: 'everyone',
      screen: async ({ person }) => knowScreen(host, person),
      // Read these: every source read together, then the draft written in the background
      act: async ({ person, body }) => {
        await readAll(host, person, KnowBody.parse(body ?? {}).off)
        void think(host, person)
        return { on: true }
      },
    })
    host.chapter({
      key: 'learned',
      title: 'What I learned',
      after: 'people',
      who: 'everyone',
      screen: async ({ person }) => learnedScreen(host, person),
      act: async ({ person, body }) => learnedAct(host, person, LearnedBody.parse(body ?? {})),
    })
  },
}
