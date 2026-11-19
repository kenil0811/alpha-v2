// Interviews (the onboarding plan of 18 Nov): the Interviewer, an agent this plugin's kit carries,
// gets to know each person here from what they let it read and what they answer, and keeps a
// report of their work in its module, Your work: their workflows, each one's steps, and what Alpha
// could build for it. On only in an Alpha whose alpha.yaml names it (rules P1). Everything it does
// goes through the plugin host, and removing this folder removes it whole; what it made stays as
// an ordinary module.
import type { Plugin } from '@alpha/plugin-sdk'
import { homeRoutes } from './home.ts'
import { proposeTool } from './propose.ts'
import { sourceTool } from './source.ts'

export const plugin: Plugin = {
  name: 'interviews',
  title: 'Interviews',
  kit: 'kit',
  // its Home row and page are in window/; their routes are here
  register(host) {
    host.tools('interviewer', [sourceTool(host), proposeTool(host)])
    homeRoutes(host)
  },
}
