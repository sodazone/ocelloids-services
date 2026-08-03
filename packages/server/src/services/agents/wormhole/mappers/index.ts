import { NewAssetOperation, NewJourney } from '@/services/agents/crosschain/index.js'
import { WormholeOperation } from '@/services/networking/apis/wormhole/types.js'
import { WormholeTokenRegistry } from '../metadata/tokens.js'
import { defaultAssetMapping, defaultJourneyMapping, toWormholeStops } from './default.js'
import { NTTMapper } from './ntt.js'
import { PortalMapper } from './portal.js'
import { RelayerMapper } from './relayer.js'

export type MapJourneyContext = {
  generateTripId: (identifiers?: { chainId: string; values: string[] }) => string
}

export type MapAssetContext = {
  journey: NewJourney
  tokenRegistry?: WormholeTokenRegistry
}

interface ProtocolMapping {
  guard: (op: WormholeOperation<any>) => boolean
  mapJourney: (op: WormholeOperation<any>, ctx: MapJourneyContext) => NewJourney
  mapAssets: (
    op: WormholeOperation<any>,
    ctx: MapAssetContext,
  ) => NewAssetOperation[] | Promise<NewAssetOperation[]>
}

const protocolMappings: ProtocolMapping[] = [NTTMapper, PortalMapper, RelayerMapper]

export type NewJourneyWithAssets = NewJourney & {
  assets: NewAssetOperation[]
}

export function mergeUpdatedStops(op: WormholeOperation, existingStops: any[]) {
  const newStops = toWormholeStops(op)
  return newStops.map((newStop: any, index: number) => {
    const existingStop = existingStops[index]

    if (newStop?.type === 'wormhole' && existingStop?.type === 'wormhole') {
      return {
        ...newStop,
        instructions: {
          ...newStop.instructions,
          value: newStop.instructions?.value ?? existingStop.instructions?.value ?? null,
        },
      }
    }

    return newStop
  })
}

export async function mapOperationToJourney(
  op: WormholeOperation,
  ctx: MapJourneyContext,
  tokenRegistry?: WormholeTokenRegistry,
): Promise<NewJourneyWithAssets> {
  let journey

  const mapping = protocolMappings.find((m) => m.guard(op))
  if (mapping) {
    journey = mapping.mapJourney(op, ctx) as NewJourneyWithAssets
    journey.assets = await mapping.mapAssets(op, { journey, tokenRegistry })
  } else {
    journey = defaultJourneyMapping(op, 'transact', 'wh', ctx) as NewJourneyWithAssets
    journey.assets = defaultAssetMapping(op, { journey })
  }

  return journey
}

export async function mapOperationsToJourneys(
  ops: WormholeOperation[],
  ctx: MapJourneyContext,
  tokenRegistry: WormholeTokenRegistry,
): Promise<NewJourneyWithAssets[]> {
  return Promise.all(ops.map((op) => mapOperationToJourney(op, ctx, tokenRegistry)))
}
