export type { DeepCamelize, SnakeToCamelCase } from '@/common/index.js'
export type {
  AssetOperationResponse,
  AssetRole,
  FullJourneyResponse,
  JourneyResponse,
  ListAsset,
} from './repositories/types.js'

/**
 * @public
 */
export type JourneyFilters =
  | {
      status?: ('received' | 'sent' | 'timeout' | 'failed')[] | undefined
      address?: string | undefined
      txHash?: string | undefined
      usdAmountGte?: number | undefined
      usdAmountLte?: number | undefined
      sentAtGte?: number | undefined
      sentAtLte?: number | undefined
      assets?: string[] | undefined
      origins?: string[] | undefined
      destinations?: string[] | undefined
      networks?: string[] | undefined
      protocols?: ('xcm' | 'wormhole_portal')[] | undefined
      actions?: string[] | undefined
    }
  | undefined

/**
 * @public
 */
export type XcQueryArgs =
  | {
      op: 'journeys.list'
      criteria?:
        | {
            status?: ('received' | 'sent' | 'timeout' | 'failed')[] | undefined
            address?: string | undefined
            txHash?: string | undefined
            usdAmountGte?: number | undefined
            usdAmountLte?: number | undefined
            sentAtGte?: number | undefined
            sentAtLte?: number | undefined
            assets?: string[] | undefined
            origins?: string[] | undefined
            destinations?: string[] | undefined
            networks?: string[] | undefined
            protocols?: ('xcm' | 'wormhole_portal')[] | undefined
            actions?: string[] | undefined
          }
        | undefined
    }
  | {
      op: 'journeys.by_id'
      criteria: {
        id: string
      }
    }
  | {
      op: 'assets.list'
    }

/**
 * @public
 */
export type XcServerSentEventArgs = {
  id?: string | undefined
  status?:
    | 'received'
    | 'sent'
    | 'timeout'
    | 'failed'
    | ('received' | 'sent' | 'timeout' | 'failed')[]
    | undefined
  address?: string | undefined
  txHash?: string | undefined
  usdAmountGte?: number | undefined
  usdAmountLte?: number | undefined
  sentAtGte?: number | undefined
  sentAtLte?: number | undefined
  assets?: string | string[] | undefined
  origins?: string | string[] | undefined
  destinations?: string | string[] | undefined
  networks?: string | string[] | undefined
  protocols?: 'xcm' | 'wormhole_portal' | ('xcm' | 'wormhole_portal')[] | undefined
  actions?: string | string[] | undefined
}
