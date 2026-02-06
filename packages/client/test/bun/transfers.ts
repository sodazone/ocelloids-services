import { createTransfersAgent, NetworkURN, transfers } from '../..'
import { existsSync } from 'fs'
import { readFile, writeFile } from 'fs/promises'
import path from 'path'

const STATE_FILE = path.resolve('./last-seen.json')

async function loadLastSeen(): Promise<number | null> {
  if (!existsSync(STATE_FILE)) {
    return null
  }

  try {
    const raw = await readFile(STATE_FILE, 'utf8')
    const parsed = JSON.parse(raw)
    return typeof parsed.lastSeen === 'number' ? parsed.lastSeen : null
  } catch {
    return null
  }
}

async function persistLastSeen(id: number): Promise<void> {
  await writeFile(
    STATE_FILE,
    JSON.stringify({ lastSeen: id }, null, 2),
    'utf8',
  )
}

const NETWORKS: NetworkURN[] | '*' = ['urn:ocn:polkadot:1000']

function normaliseDecimals(amount: string | bigint, decimals: number): string {
  const a = BigInt(amount)
  const divisor = 10n ** BigInt(decimals)

  const whole = a / divisor
  const fraction = a % divisor

  const fractionStr = fraction.toString().padStart(10, '0')

  return `${whole}.${fractionStr}`
}

function shortenAddress(address: string) {
  if (!address || typeof address !== 'string') {
    return ''
  }

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

let lastSeen: number | null = await loadLastSeen()

if (lastSeen !== null) {
  console.log('Resuming from lastSeen =', lastSeen)
}

// const subId = 'transfers-all-networks'

const subId = 'transfers-asset-hub'

// await agent.createSubscription({
//   id: subId,
//   args: {
//     networks: NETWORKS,
//   },
//   channels: [
//     {
//       type: "websocket"
//     }
//   ]
// });

function toReplayQueryArgs(next?: number): transfers.IcTransferQueryArgs | null {
  if (lastSeen === null) {
    return null
  }
  const args: transfers.IcTransferQueryArgs = {
    op: 'transfers.by_id_range',
    criteria: {
      start: lastSeen + 1,
      ...(next !== undefined ? { end: next - 1 } : {}),
    }
  }
  if (NETWORKS !== '*') {
    args.criteria.networks = NETWORKS
  }
  return args
}

agent.subscribeWithReplay<transfers.IcTransferResponse, transfers.IcTransferQueryArgs, transfers.IcTransferResponse>(
  subId,
  {
    onMessage: ({ payload }) => {
      const { from, fromFormatted, to, toFormatted, amount, decimals, symbol, blockNumber, eventIndex, network, id } = payload
      if (lastSeen !== null && id <= lastSeen) {
        return
      }

      lastSeen = id
      persistLastSeen(id).catch(console.error)
      const a = Number(normaliseDecimals(amount, decimals ?? 0))

      console.log(`[${id}] Transfer ${a.toFixed(4)} ${symbol} from ${shortenAddress(fromFormatted ?? from)} to ${shortenAddress(toFormatted ?? to)} (${network} ${blockNumber}-${eventIndex})`)
    },
    onError: (error) => console.log(error),
    onClose: (event) => console.log(event.reason),
  },
  {
    toQueryArgs: toReplayQueryArgs,
    onCompleteRange: () => console.log('complete range'),
    onIncompleteRange: async (missed) => console.log('incomplete', missed)
  }
)
