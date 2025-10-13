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

export type NewJourneyWithAssets = NewJourney & {
  assets: NewAssetOperation[]
}

export function mapOperationToJourney(op: WormholeOperation): NewJourneyWithAssets {
  let journey

  const mapping = protocolMappings.find((m) => m.guard(op))
  if (mapping) {
    journey = mapping.mapJourney(op) as NewJourneyWithAssets
    journey.assets = mapping.mapAssets(op, journey)
  } else {
    journey = defaultJourneyMapping(op, 'transact', 'wh') as NewJourneyWithAssets
    journey.assets = defaultAssetMapping(op, journey)
  }

  return journey
}

export function mapOperationsToJourneys(ops: WormholeOperation[]): NewJourneyWithAssets[] {
  return ops.map(mapOperationToJourney)
}
