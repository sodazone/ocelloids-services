/* istanbul ignore file */
import { HexString, NetworkURN } from '@/lib.js'

import { SubstrateApiClient } from '../index.js'
import { NetworkInfo } from '../ingress/types.js'

function getPropertyArray(p: any[] | any) {
  return p ? (Array.isArray(p) ? p : [p]) : []
}

async function networkInfo(api: SubstrateApiClient, chainId: NetworkURN): Promise<NetworkInfo> {
  const chainSpecData = await api.getChainSpecData()
  const {
    tokenDecimals,
    tokenSymbol,
    SS58Prefix,
  }: {
    SS58Prefix?: number
    tokenDecimals?: number[] | number
    tokenSymbol?: string[] | string
  } = chainSpecData.properties

  const existentialDeposit = api.ctx.getConstant('Balances', 'ExistentialDeposit')?.toString()

  const chainTokens = getPropertyArray(tokenSymbol)
  const chainDecimals = getPropertyArray(tokenDecimals)
  const ss58Prefix = SS58Prefix ?? 42

  const genesisHash = chainSpecData.genesisHash as HexString
  const runtimeChain = chainSpecData.name
  const parachainId = api.ctx.hasPallet('ParachainInfo')
    ? (await api.query<number>('ParachainInfo', 'ParachainId')).toString()
    : undefined

  return {
    urn: chainId,
    genesisHash,
    existentialDeposit,
    chainTokens,
    chainDecimals,
    ss58Prefix,
    parachainId,
    runtimeChain,
  }
}

export const fetchers = {
  networkInfo,
}
