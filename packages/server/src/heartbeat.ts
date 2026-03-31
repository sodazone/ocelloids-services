import { WebSocket } from '@fastify/websocket'
import { FastifyInstance } from 'fastify'

type AliveWebSocket = WebSocket & { isAlive?: boolean }

const HEARTBEAT_INTERVAL = 25_000

export function registerWebsocketHeartbeat(fastify: FastifyInstance) {
  fastify.addHook('onReady', async () => {
    const wss = fastify.websocketServer
    if (!wss) {
      return
    }

    wss.on('connection', (ws: AliveWebSocket) => {
      ws.isAlive = true

      ws.on('pong', () => {
        ws.isAlive = true
      })
    })

    const interval = setInterval(() => {
      wss.clients.forEach((ws: AliveWebSocket) => {
        if (ws.isAlive === false) {
          ws.terminate()
          return
        }

        ws.isAlive = false
        ws.ping()
      })
    }, HEARTBEAT_INTERVAL)

    fastify.addHook('onClose', async () => {
      clearInterval(interval)
    })
  })
}
