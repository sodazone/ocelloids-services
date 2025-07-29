import WebSocket, { WebSocketServer } from 'ws'

export function createProxy({
  upstreamUrl = 'wss://rpc.ibp.network/polkadot',
  proxyPort = 9999,
}: {
  upstreamUrl?: string
  proxyPort?: number
} = {}) {
  const wss = new WebSocketServer({ port: proxyPort })

  const connections = new Set<{
    client: WebSocket
    upstream: WebSocket
    stalled: boolean
    messageQueue: string[]
  }>()

  console.log(`> Proxy running on ws://127.0.0.1:${proxyPort}`)

  wss.on('connection', (client) => {
    const upstream = new WebSocket(upstreamUrl)
    const messageQueue: string[] = []

    const connection = { client, upstream, stalled: false, messageQueue }
    connections.add(connection)

    upstream.on('open', () => {
      while (messageQueue.length > 0) {
        const msg = messageQueue.shift()
        if (msg) {
          upstream.send(msg)
        }
      }
    })

    upstream.on('message', (msg) => {
      if (!connection.stalled && client.readyState === WebSocket.OPEN) {
        client.send(msg.toString())
      }
    })

    client.on('message', (msg) => {
      if (upstream.readyState === WebSocket.OPEN) {
        upstream.send(msg.toString())
      } else {
        messageQueue.push(msg.toString())
      }
    })

    client.on('close', () => {
      upstream.close()
      connections.delete(connection)
    })
  })

  return {
    toggle: () => {
      for (const conn of connections) {
        conn.stalled = !conn.stalled
      }
      console.log(
        '> Proxy toggled stalled for connections:',
        Array.from(connections).map((c) => c.stalled),
      )
    },
  }
}
