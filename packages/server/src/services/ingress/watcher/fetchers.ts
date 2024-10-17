/* istanbul ignore file */
import { HexString, NetworkURN } from '@/lib.js'
import { ApiClient } from '@/services/networking/client.js'
import { NetworkInfo } from '../index.js'

// from https://github.com/polkadot-js/apps/blob/master/packages/react-hooks/src/useBlockInterval.ts

const DEFAULT_TIME = 6_000n

/* TODO: port to new client
async function resolveBlockTime(api: PapiClient) {
  const blockTimeAura = api.call.auraApi?.slotDuration && (await api.call.auraApi.slotDuration<bigint>())
  const blockTimeBabe =
    api.call.babeApi?.configuration && (await api.call.babeApi.configuration())?.slotDuration.toBigInt()

  return (
    (blockTimeAura || blockTimeBabe) ??
    // Babe, e.g. Relay chains (Substrate defaults)
    (api.consts.babe?.expectedBlockTime ||
      // POW, eg. Kulupu
      api.consts.difficulty?.targetBlockTime ||
      // Subspace
      api.consts.subspace?.expectedBlockTime ||
      // Check against threshold to determine value validity
      (api.consts.timestamp?.minimumPeriod.toBigInt() >= 500n
        ? // Default minimum period config
          api.consts.timestamp.minimumPeriod.toBigInt() * 2n
        : api.query.parachainSystem
          ? // default guess for a parachain
            api.consts.aura?.slotDuration ?? DEFAULT_TIME * 2n
          : // default guess for others
            DEFAULT_TIME))
  )
}
*/

function getPropertyArray(p: any[] | any) {
  return p ? (Array.isArray(p) ? p : [p]) : []
}

async function networkInfo(api: ApiClient, chainId: NetworkURN): Promise<NetworkInfo> {
  const chainSpecData = await api.getChainSpecData()
  const {
    tokenDecimals,
    tokenSymbol,
    ss58Format,
  }: {
    ss58Format?: number
    tokenDecimals?: number[] | number
    tokenSymbol?: string[] | string
  } = chainSpecData.properties

  const existentialDeposit = api.ctx.getConstant('Balances', 'ExistentialDeposit')?.toString()

  const chainTokens = getPropertyArray(tokenSymbol)
  const chainDecimals = getPropertyArray(tokenDecimals)
  const ss58Prefix = ss58Format ?? 42

  const genesisHash = chainSpecData.genesisHash as HexString
  const runtimeChain = chainSpecData.name
  const parachainId = api.ctx.hasPallet('ParachainInfo')
    ? (await api.query<number>('ParachainInfo', 'ParachainId')).toString()
    : undefined

  const blockTime = 12 //await resolveBlockTime(api)

  return {
    urn: chainId,
    genesisHash,
    existentialDeposit,
    chainTokens,
    chainDecimals,
    ss58Prefix,
    parachainId,
    runtimeChain,
    blockTime: Number(blockTime),
  }
}

export const fetchers = {
  networkInfo,
}
