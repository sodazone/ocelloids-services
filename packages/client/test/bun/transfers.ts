import { createTransfersAgent, transfers } from '../..'

function normaliseDecimals(amount: string | bigint, decimals: number): string {
  const a = BigInt(amount)
  const divisor = 10n ** BigInt(decimals)

  const whole = a / divisor
  const fraction = a % divisor

  const fractionStr = fraction.toString().padStart(10, '0')

  return `${whole}.${fractionStr}`
}

const agent = createTransfersAgent({
  httpUrl: 'http://127.0.0.1:3000',
  wsUrl: 'ws://127.0.0.1:3000',
})

const subId = 'my-transfers-sub'

// await agent.createSubscription({
//   id: subId,
//   args: {
//     networks: ["urn:ocn:polkadot:1000"],
//   },
//   channels: [
//     {
//       type: "websocket"
//     }
//   ]
// });

agent.subscribe(
  subId,
  {
    onMessage: ({ payload }) => {
      const { from, to, amount, decimals, symbol, volume } = payload
      console.log(`Transfer ${normaliseDecimals(amount, decimals ?? 0)} ${symbol} (${volume} USD) from ${from} to ${to}`)
    },
    onError: (error) => console.log(error),
    onClose: (event) => console.log(event.reason),
  }
)
