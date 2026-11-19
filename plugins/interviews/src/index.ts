// Interviews (the onboarding plan of 18 Nov): the Interviewer, an agent this plugin's kit carries,
// gets to know each person here from what they let it read and what they answer, and keeps a
// report of their work in its module, Your work: their workflows, each one's steps, and what Alpha
// could build for it. On only in an Alpha whose alpha.yaml names it (rules P1). Everything it does
// goes through the plugin host, and removing this folder removes it whole; what it made stays as
// an ordinary module.
import type { Plugin } from '@alpha/plugin-sdk'

export const plugin: Plugin = {
  name: 'interviews',
  title: 'Interviews',
  kit: 'kit',
  // its agent's tools, its routes and its screens come with the steps that need them
  register() {},
}
