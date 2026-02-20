import { createCrosschainAgent, NetworkURN } from '../..'
import { existsSync } from 'fs'
import { readFile, writeFile } from 'fs/promises'
import path from 'path'

const STATE_FILE = path.resolve('./last-seen-xc.json')
const NETWORKS: NetworkURN[] | '*' = '*'

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

const agent = createCrosschainAgent({
  httpUrl: 'http://127.0.0.1:3000',
  wsUrl: 'ws://127.0.0.1:3000',
})

let lastSeen: number | null = await loadLastSeen()

if (lastSeen !== null) {
  console.log('Resuming from lastSeen =', lastSeen)
}

const subId = 'xc-all-networks'

// await agent.deleteSubscription(subId)

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

agent.subscribeWithReplay(
  subId,
  {
    onMessage: ({ payload }) => {
      const { from, fromFormatted, to, toFormatted, origin, destination, id, status } = payload

      console.log(`[${id}] Transfer from ${shortenAddress(fromFormatted ?? from)} (${origin}) to ${shortenAddress(toFormatted ?? to)} (${destination}) (status=${status})`)
    },
    onError: (error) => console.log(error),
    onClose: (event) => console.log(event.reason),
  },
  {
    lastSeenId: lastSeen ?? undefined,
    onPersist: persistLastSeen,
    onCompleteRange: () => console.log('complete range'),
    onIncompleteRange: async (missed) => console.log('incomplete', missed)
  }
)
