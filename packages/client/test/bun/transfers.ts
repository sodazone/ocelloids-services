import { createTransfersAgent, transfers } from '../..'

function normaliseDecimals(amount: string | bigint, decimals: number): string {
  const a = BigInt(amount)
  const divisor = 10n ** BigInt(decimals)

  const whole = a / divisor
  const fraction = a % divisor

  const fractionStr = fraction.toString().padStart(10, '0')

  return `${whole}.${fractionStr}`
}

function shortenAddress(address: string) {
  if (!address || typeof address !== 'string') return ''

  if (address.startsWith('0x') && address.length === 42) {
    return `${address.slice(0, 6)}…${address.slice(-4)}`
  }

  if (address.length < 20) {
    return address
  }

  if (address.length >= 40) {
    return `${address.slice(0, 8)}…${address.slice(-8)}`
  }

  return `${address.slice(0, 6)}…${address.slice(-4)}`
}

const agent = createTransfersAgent({
  httpUrl: 'http://127.0.0.1:3000',
  wsUrl: 'ws://127.0.0.1:3000',
})

const subId = 'transfers-all-networks'

await agent.createSubscription({
  id: subId,
  args: {
    networks: '*',
  },
  channels: [
    {
      type: "websocket"
    }
  ]
});

agent.subscribe(
  subId,
  {
    onMessage: ({ payload }) => {
      const { from, fromFormatted, to, toFormatted, amount, decimals, symbol, blockNumber, eventIndex, network, id } = payload
      const a = Number(normaliseDecimals(amount, decimals ?? 0))
      if (a > 1) {
        console.log(`[${id}] Transfer ${a.toFixed(4)} ${symbol} from ${shortenAddress(fromFormatted ?? from)} to ${shortenAddress(toFormatted ?? to)} (${network} ${blockNumber}-${eventIndex})`)
      }
    },
    onError: (error) => console.log(error),
    onClose: (event) => console.log(event.reason),
  }
)
