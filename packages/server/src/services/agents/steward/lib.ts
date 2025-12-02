import type {
  AccountData,
  AssetData,
  BalanceEvent,
  BalanceEventName,
  BalanceEvents,
  BalancesData,
  StatusData,
  StatusEvent,
  SyncedEvent,
} from './balances/sse.js'
import type { AssetId, AssetIds, AssetMetadata } from './types.js'

/**
 * @public
 */
type StewardServerSentEventArgs = {
  account: string | string[]
}

/**
 * @public
 */
type StewardQueryArgs =
  | {
      op: 'assets'
      criteria: {
        assets: string[]
        network: string
      }[]
    }
  | {
      op: 'assets.list'
      criteria?:
        | {
            network: string
          }
        | undefined
    }
  | {
      op: 'assets.by_location'
      criteria: {
        xcmLocationAnchor: string
        locations: string[]
      }[]
    }
  | {
      op: 'assets.by_hash'
      criteria: {
        assetHashes: string[]
      }
    }
  | {
      op: 'chains.list'
    }
  | {
      op: 'chains'
      criteria: {
        networks: string[]
      }
    }
  | {
      op: 'chains.prefix'
      criteria: {
        networks: string[]
      }
    }

export type {
  AssetMetadata,
  StewardQueryArgs,
  StewardServerSentEventArgs,
  AssetIds,
  AssetId,
  BalanceEvents,
  AccountData,
  AssetData,
  BalanceEvent,
  BalanceEventName,
  BalancesData,
  StatusData,
  StatusEvent,
  SyncedEvent,
}
