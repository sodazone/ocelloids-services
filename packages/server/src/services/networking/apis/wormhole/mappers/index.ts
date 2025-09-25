import { NewAssetOperation, NewJourney } from '@/services/agents/crosschain/index.js'
import { WormholeOperation } from '@/services/networking/apis/wormhole/types.js'
import { defaultAssetMapping, defaultJourneyMapping } from './default.js'
import { PortalMapper } from './portal.js'
import { RelayerMapper } from './relayer.js'

interface ProtocolMapping {
  guard: (op: WormholeOperation<any>) => boolean
  mapJourney: (op: WormholeOperation<any>) => NewJourney
  mapAssets: (op: WormholeOperation<any>, journey: NewJourney) => NewAssetOperation[]
}

const protocolMappings: ProtocolMapping[] = [PortalMapper, RelayerMapper]

type NewJourneyWithAssets = NewJourney & {
  assets: NewAssetOperation[]
}

export function mapOperationsToJourneys(ops: WormholeOperation[]): NewJourneyWithAssets[] {
  const journeys: NewJourneyWithAssets[] = []

  ops.forEach((op) => {
    const mapping = protocolMappings.find((m) => m.guard(op))
    if (mapping) {
      const journey = mapping.mapJourney(op) as NewJourneyWithAssets
      journey.assets = mapping.mapAssets(op, journey)
      journeys.push(journey)
    } else {
      const journey = defaultJourneyMapping(op, '??', 'wh') as NewJourneyWithAssets
      journey.assets = defaultAssetMapping(op)
      journeys.push(journey)
    }
  })

  return journeys
}
