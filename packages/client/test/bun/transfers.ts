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
      const { from, fromFormatted, to, toFormatted, amount, decimals, symbol, blockNumber, eventIndex, network, id } = payload
        const a = Number(normaliseDecimals(amount, decimals ?? 0))
        console.log(`[${id}] Transfer ${a.toFixed(4)} ${symbol} from ${fromFormatted ?? from} to ${toFormatted ?? to} (${network} ${blockNumber}-${eventIndex})`)
    },
    onError: (error) => console.log(error),
    onClose: (event) => console.log(event.reason),
  }
)
