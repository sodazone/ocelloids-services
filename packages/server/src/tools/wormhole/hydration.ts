import { WormholeIds } from '@/services/agents/steward/metadata/queries/wormhole.js'
import {
  makeWatcher,
  WormholescanClient,
  WormholeWatcherConfig,
} from '@/services/networking/apis/wormhole/index.js'

const { HYDRATION_ID, NEAR_ID } = WormholeIds

const ago = 3 * 24 * 60 * 60 * 1000
const cutDate = new Date(Date.now() - ago).toISOString()

const chains: WormholeWatcherConfig[] = [
  { chain: HYDRATION_ID, mode: 'operations' },
  { chain: NEAR_ID, address: 'omni-relayer.bridge.near', mode: 'operations' },
  {
    chain: NEAR_ID,
    address: 'd473056b88c2062503ea1425bdea8e87609e3d499b3b4d1809e440df2d7cb9e3',
    mode: 'vaas',
  },
]

const client = new WormholescanClient()

const watcher = makeWatcher(client /*, storage */)
const initialState = await watcher.loadInitialState(chains, cutDate)

watcher.operations$(initialState, 10_000).subscribe({
  next: ({ op }) => {
    console.log('Got op:', op.id, op.sourceChain.timestamp)
    //console.log(mapOperationToJourney(op), '---', JSON.stringify(op))
    // console.log(JSON.stringify(op))
  },
  error: (err) => console.error('Watcher error:', err),
})
