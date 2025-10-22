import { HexString, NetworkURN } from '@/lib.js'

import { SubstrateApi } from '../index.js'
import { SubstrateNetworkInfo } from '../ingress/types.js'

function getPropertyArray(p: any[] | any) {
  return p ? (Array.isArray(p) ? p : [p]) : []
}

async function networkInfo(api: SubstrateApi, chainId: NetworkURN): Promise<SubstrateNetworkInfo> {
  const chainSpecData = await api.getChainSpecData()
  const {
    tokenDecimals,
    tokenSymbol,
    ss58Format,
  }: {
    ss58Format?: number | null
    tokenDecimals?: number[] | number
    tokenSymbol?: string[] | string
  } = chainSpecData.properties

  const ctx = await api.ctx()
  let existentialDeposit
  try {
    existentialDeposit = ctx.getConstant('Balances', 'ExistentialDeposit')?.toString()
  } catch {
    // ignore
  }

  const chainTokens = getPropertyArray(tokenSymbol)
  const chainDecimals = getPropertyArray(tokenDecimals)

  const genesisHash = chainSpecData.genesisHash as HexString
  const runtimeChain = chainSpecData.name
  const parachainId = ctx.hasPallet('ParachainInfo')
    ? ((await api.query<number>({ module: 'ParachainInfo', method: 'ParachainId' }))?.toString() ?? undefined)
    : undefined

  return {
    urn: chainId,
    genesisHash,
    existentialDeposit,
    chainTokens,
    chainDecimals,
    ss58Prefix: ss58Format,
    parachainId,
    runtimeChain,
  }
}

export const fetchers = {
  networkInfo,
}
