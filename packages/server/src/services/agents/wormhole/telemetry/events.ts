import { TypedEventEmitter } from '@/services/types.js'

import { FullJourney } from '../../crosschain/index.js'

export type TelemetryEvents = {
  telemetryWormholeJourneyBroadcast: (message: FullJourney) => void
  telemetryWormholeError: (error: { code: string; id: string }) => void
}

export type TelemetryWormholeEventEmitter = TypedEventEmitter<TelemetryEvents>
