import { WormholeIds, WormholescanClient, makeWatcher } from '@/services/networking/apis/wormhole/index.js'
import { mapOperationToJourney } from '@/services/networking/apis/wormhole/mappers/index.js'

const { MOONBEAM_ID } = WormholeIds

const ago = 1 * 24 * 60 * 60 * 1000
const cutDate = new Date(Date.now() - ago).toISOString()

const chains = [MOONBEAM_ID]

const watcher = makeWatcher(new WormholescanClient() /*, storage */)
const initialState = await watcher.loadInitialState(chains, cutDate)

watcher.operations$(initialState, 10_000).subscribe({
  next: ({ op, status }) => {
    console.log('Got op:', op.id, op.sourceChain.timestamp, status)
    console.log(mapOperationToJourney(op), '---', JSON.stringify(op))
  },
  error: (err) => console.error('Watcher error:', err),
})
