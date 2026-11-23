// How each way to reach Claude is set up, for the ⓘ beside it in Settings › Models: a server takes
// a subscription as a token made on the person's own computer, a Mac signs in in the browser.
import type { ModelView } from '@alpha/core/api'

export function modelHelp(route: ModelView['route'], onServer: boolean): string {
  if (route === 'key')
    return 'In the Claude Console (console.anthropic.com), open API keys and create one. Copy it (it starts sk-ant-), paste it here and press Save, then Use this. Usage is billed to that Console account.'
  return onServer
    ? 'On your own computer, install Claude Code, then run claude setup-token in Terminal and sign in with the Claude account whose plan Alpha should use. It prints a token starting sk-ant-: paste it here and press Save. Alpha keeps it sealed on this server.'
    : 'Press Sign in and finish in the browser with your Claude account. Alpha uses Claude Code’s own sign-in on this Mac and never sees it.'
}
