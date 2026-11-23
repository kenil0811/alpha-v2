// Agents: the agents down the left, and the chosen one's Chat or its Setup, switched in the bar's
// centre. Chat lands like Home, on a bar for a new chat and the agent's cards; its whole
// conversation is #/conversation/chat (Vikas, 23 Nov). Setup is the agent's own page, the same as Settings › Agents opens; picking another
// agent keeps the part on screen.
import type { AgentView, Stream } from '@alpha/core/api'
import { AgentLanding } from './AgentLanding.tsx'
import { AgentPage, AgentRail } from './Agents.tsx'
import { Conversation } from './Conversation.tsx'
import { Tabs } from './ui/tabs.tsx'

const named = () => undefined // the bar shows the switch, not the agent's name

export function AgentsScreen({
  setup,
  whole,
  agents,
  chosen,
  agent,
  onPick,
  stream,
  busyTurn,
  version,
}: {
  setup: boolean
  whole: boolean
  agents: AgentView[]
  chosen: string
  agent: AgentView | null
  onPick: (id: string) => void
  stream: Stream | null
  busyTurn: string | null
  version: number
}) {
  return (
    <div className="flex h-full min-h-0">
      <Tabs
        label="Agent"
        tabs={[
          { key: 'chat', href: '#/conversation', label: 'Chat', sel: !setup },
          { key: 'setup', href: '#/conversation/setup', label: 'Setup', sel: setup },
        ]}
      />
      <AgentRail agents={agents} chosen={chosen} onPick={onPick} stream={stream} />
      <div className="min-w-0 flex-1">
        {setup ? (
          <AgentPage key={chosen} id={chosen} version={version} onName={named} inAgents />
        ) : whole ? (
          <Conversation stream={stream} busyTurn={busyTurn} agent={agent} agents={agents} />
        ) : (
          agent && <AgentLanding agent={agent} agents={agents} stream={stream} version={version} />
        )}
      </div>
    </div>
  )
}
