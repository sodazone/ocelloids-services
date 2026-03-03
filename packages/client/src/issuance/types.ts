import { sourceIssuance } from '../server-types'

/**
 * @public
 */
export type CrosschainIssuancePayload = sourceIssuance.CrosschainIssuancePayload

/**
 * @public
 */
export type CrosschainIssuanceQueryArgs = sourceIssuance.CrosschainIssuanceQueryArgs

/**
 * @public
 */
export type CrosschainIssuanceInputs = {
  reserveChain: string
  reserveAssetId: string | number | Record<string, any>
  reserveAddress: string
  reserveDecimals: number
  remoteChain: string
  remoteAssetId: string | number | Record<string, any>
  remoteDecimals: number
  assetSymbol: string
}
