import { createDefiAgent } from '../..'

const agent = createDefiAgent({
  httpUrl: 'http://127.0.0.1:3000',
  wsUrl: 'ws://127.0.0.1:3000',
})

agent.subscribe({
    topic: "liquidity",
  networks: "*",
}, {
  onMessage: (m) => {
    //console.log("L")
  }
  })

agent.subscribe({
    topic: "event",
  networks: "*",
}, {
  onMessage: (m) => {
    console.log(m, JSON.stringify    (m.payload))
  }
  })
