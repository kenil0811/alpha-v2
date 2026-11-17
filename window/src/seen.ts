// The person has an agent's chat in front of them: its Failed mark in the Agents list goes
// (ui-rules A11). Told to the core only while the mark is there.
import type { Stream } from '@alpha/core/api'
import { useEffect } from 'react'
import { api } from './api.ts'

export function useChatSeen(agent: string | null, stream: Stream | null): void {
  const failed = !!agent && !!stream?.failed.includes(agent)
  useEffect(() => {
    if (failed && agent) api.post(`/api/agents/${agent}/seen`).catch(() => undefined)
  }, [failed, agent])
}
