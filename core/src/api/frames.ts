// A live picture's frames over a websocket, one at a time: a frame goes as bytes, and the next is
// not asked of the browser until the window says it drew this one. A slow line then shows the page
// as it is now, a little less often, and never falls behind it.
import type { WebSocket } from '@fastify/websocket'

export function framesTo(socket: WebSocket): {
  send: (jpeg: Buffer) => Promise<void>
  drawn: () => void
} {
  let taken: (() => void) | null = null
  return {
    send(jpeg) {
      if (socket.readyState !== 1) return Promise.resolve()
      socket.send(jpeg)
      return new Promise((ok) => {
        taken = ok
      })
    },
    drawn() {
      taken?.()
      taken = null
    },
  }
}
