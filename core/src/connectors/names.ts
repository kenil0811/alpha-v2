// What a connector's tool is called: its name for the model and back, and the gate's name for it.
// The name a tool has for the model, and back.
export function mcpName(connector: string, tool: string): string {
  return `mcp__${connector}__${tool}`
}

export function splitMcpName(name: string): { connector: string; tool: string } | null {
  const m = /^mcp__([^_].*?)__(.+)$/.exec(name)
  return m?.[1] && m[2] ? { connector: m[1], tool: m[2] } : null
}

export interface Preview {
  words: string
  detail?: string
  yes?: string // the card's yes in its own words (Send it)
}

// The gate's name for a tool: what a card and a standing permission are keyed by.
export function gateKey(connector: string, tool: string): string {
  return `${connector}_${tool}`
}
