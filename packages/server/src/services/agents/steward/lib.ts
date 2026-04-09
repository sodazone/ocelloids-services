import type {
  AccountCategory,
  AccountIdentity,
  AccountTag,
  SubstrateAccountMetadata,
  SubstrateAccountResult,
} from './accounts/types.js'
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
  | {
      op: 'accounts'
      criteria: {
        accounts: string[]
      }
    }
  | {
      op: 'accounts.list'
    }
  | {
      op: 'accounts.updated_since'
      criteria: {
        since: number
      }
    }

export type {
  AccountCategory,
  AccountData,
  AccountIdentity,
  AccountTag,
  AssetData,
  AssetId,
  AssetIds,
  AssetMetadata,
  BalanceEvent,
  BalanceEventName,
  BalanceEvents,
  BalancesData,
  StatusData,
  StatusEvent,
  StewardQueryArgs,
  StewardServerSentEventArgs,
  SubstrateAccountMetadata,
  SubstrateAccountResult,
  SyncedEvent,
}
