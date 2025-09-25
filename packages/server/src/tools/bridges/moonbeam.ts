import {
  WormholeIds,
  WormholeOperation,
  WormholescanClient,
} from '@/services/networking/apis/wormhole/index.js'
import { mapOperationsToJourneys } from '@/services/networking/apis/wormhole/mappers/index.js'

const { MOONBEAM_ID } = WormholeIds

// Functional helper to deduplicate operations by `id`
const dedupeById = (ops: WormholeOperation[]) => Array.from(new Map(ops.map((op) => [op.id, op])).values())

// Fetch new operations from both source OR target = Moonbeam since checkpoint
async function fetchMoonbeamOpsSince(client: WormholescanClient, checkpoint: string) {
  const [sourceOps, targetOps] = await Promise.all([
    client.fetchAllOperations({ sourceChain: MOONBEAM_ID, from: checkpoint }),
    client.fetchAllOperations({ targetChain: MOONBEAM_ID, from: checkpoint }),
  ])
  return dedupeById([...sourceOps, ...targetOps])
}

// Long-polling loop
export async function pollMoonbeamOps(
  checkpoint: string,
  onOps: (ops: WormholeOperation[]) => void,
  intervalMs = 10_000,
) {
  const client = new WormholescanClient()
  let lastCheckpoint = checkpoint

  while (true) {
    try {
      const ops = await fetchMoonbeamOpsSince(client, lastCheckpoint)
      if (ops.length > 0) {
        onOps(ops)
        // Update checkpoint to last operation timestamp
        lastCheckpoint = ops[ops.length - 1].sourceChain.timestamp
      }
    } catch (err) {
      console.error('Error fetching Moonbeam ops', err)
    }
    await new Promise((resolve) => setTimeout(resolve, intervalMs))
  }
}

const tenHoursAgo = new Date(Date.now() - 10 * 60 * 60 * 1000).toISOString()
await pollMoonbeamOps(tenHoursAgo, (ops) => {
  ops.forEach((op) => {
    console.log(`Operation ${op.id}: ${op.content.standarizedProperties.amount} tokens`)
  })
  //mapOperationsToJourneys(ops)
  console.log(JSON.stringify(mapOperationsToJourneys(ops)))
})
