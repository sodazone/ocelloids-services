import { FrontierExtrinsic, isFrontierExtrinsic } from '@/services/networking/substrate/evm/decoder.js'
import { BlockEvent, Event } from '@/services/networking/substrate/types.js'
import { NetworkURN } from '@/services/types.js'
import { AssetSwap, ConnectionId } from '../types/index.js'
import { matchEvent } from './util.js'

const GMP_PRECOMPILE = '0x0000000000000000000000000000000000000816'

export const swapMapping: Record<
  NetworkURN,
  { match: (event: Event) => boolean; transform: (event: BlockEvent) => AssetSwap }
> = {
  'urn:ocn:polkadot:1000': {
    match: (event: Event) => matchEvent(event, 'AssetConversion', 'SwapCreditExecuted'),
    transform: (event: BlockEvent): AssetSwap => {
      const { amount_in, amount_out, path } = event.value
      return {
        assetIn: {
          amount: amount_in,
          localAssetId: path[0][0],
        },
        assetOut: {
          amount: amount_out,
          localAssetId: path[path.length - 1][0],
        },
        event,
      } as AssetSwap
    },
  },
  'urn:ocn:polkadot:2034': {
    match: (event: Event) => matchEvent(event, 'Router', 'Executed'),
    transform: (event: BlockEvent): AssetSwap => {
      const { amount_in, amount_out, asset_in, asset_out } = event.value
      return {
        assetIn: {
          amount: amount_in,
          localAssetId: asset_in,
        },
        assetOut: {
          amount: amount_out,
          localAssetId: asset_out,
        },
        event,
      } as AssetSwap
    },
  },
}

export const crossProtocolCorrelationMapping: {
  outbound: Record<
    NetworkURN,
    { match: (event: BlockEvent) => boolean; toConnectionId: (event: BlockEvent) => ConnectionId | undefined }
  >
  inbound: Record<
    NetworkURN,
    { match: (event: Event) => boolean; toConnectionId: (event: Event) => ConnectionId | undefined }
  >
} = {
  outbound: {
    'urn:ocn:polkadot:2004': {
      match: (event) => {
        const extrinsic = event.extrinsic
        if (extrinsic && extrinsic.evmTxHash && isFrontierExtrinsic(extrinsic)) {
          const { transaction } = extrinsic.args as FrontierExtrinsic
          if (transaction.value.action.value === GMP_PRECOMPILE) {
            return true
          }
        }
        return false
      },
      toConnectionId: (event) => {
        if (event.extrinsic && event.extrinsic.evmTxHash) {
          return { chainId: 'urn:ocn:polkadot:2004', data: event.extrinsic.evmTxHash }
        }
      },
    },
  },
  inbound: {
    'urn:ocn:polkadot:2004': {
      match: (event) => matchEvent(event, 'EthereumXcm', 'ExecutedFromXcm'),
      toConnectionId: (event) => {
        if (event.value.eth_tx_hash) {
          return { chainId: 'urn:ocn:polkadot:2004', data: event.value.eth_tx_hash }
        }
      },
    },
  },
}
