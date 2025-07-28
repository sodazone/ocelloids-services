import WebSocket, { WebSocketServer } from 'ws'

const upstreamUrl = 'wss://rpc.ibp.network/polkadot'
const proxyPort = 9999

const wss = new WebSocketServer({ port: proxyPort })

let stall = false

console.log(`Proxy running on ws://127.0.0.1:${proxyPort}`)

wss.on('connection', (client) => {
  const upstream = new WebSocket(upstreamUrl)

  const messageQueue: string[] = []

  upstream.on('open', () => {
    console.log('Connected to upstream')

    while (messageQueue.length > 0) {
      const msg = messageQueue.shift()
      if (msg) {
        upstream.send(msg)
      }
    }
  })

  upstream.on('message', (msg) => {
    if (!stall && client.readyState === WebSocket.OPEN) {
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

  client.on('close', () => upstream.close())
})

setTimeout(() => {
  console.log('Stalling upstream messages...')
  stall = true
}, 10_000)

setTimeout(() => {
  console.log('Recovering upstream messages...')
  stall = false
}, 31_000)
