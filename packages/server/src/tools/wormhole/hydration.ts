import { WormholeIds } from '@/services/agents/wormhole/types/chain.js'
import { makeWatcher, WormholescanClient } from '@/services/networking/apis/wormhole/index.js'

const { HYDRATION_ID } = WormholeIds

const ago = 1 * 24 * 60 * 60 * 1000
const cutDate = new Date(Date.now() - ago).toISOString()

const chains = [HYDRATION_ID]

const client = new WormholescanClient()

console.log(
  JSON.stringify(
    await client.fetchOperationById('73/0000000000000000000000004e7b1e55d2354d4dc6abd876096dc201de0541d1/74'),
  ),
)
process.exit(0)
const watcher = makeWatcher(client /*, storage */)
const initialState = await watcher.loadInitialState(chains, cutDate)

watcher.operations$(initialState, 10_000).subscribe({
  next: ({ op }) => {
    //console.log('Got op:', op.id, op.sourceChain.timestamp, status)
    //console.log(mapOperationToJourney(op), '---', JSON.stringify(op))
    console.log(JSON.stringify(op))
  },
  error: (err) => console.error('Watcher error:', err),
})
