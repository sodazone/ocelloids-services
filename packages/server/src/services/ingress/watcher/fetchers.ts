import { ApiPromise } from '@polkadot/api'

import { NetworkURN } from '@/lib.js'
import { NetworkInfo } from '../index.js'

// from https://github.com/polkadot-js/apps/blob/master/packages/react-hooks/src/useBlockInterval.ts

const DEFAULT_TIME = 6_000n

async function resolveBlockTime(api: ApiPromise) {
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

async function networkInfo(apiPromise: ApiPromise, chainId: NetworkURN): Promise<NetworkInfo> {
  const api = await apiPromise.isReady

  const existentialDeposit = api.consts.balances?.existentialDeposit?.toString()
  const chainTokens = api.registry.chainTokens
  const chainDecimals = api.registry.chainDecimals
  const ss58Prefix = api.registry.chainSS58

  const genesisHash = api.genesisHash
  const runtimeChain = api.runtimeChain.toString()
  const parachainId =
    api.query.parachainInfo === undefined
      ? undefined
      : (await api.query.parachainInfo.parachainId()).toString()

  const blockTime = await resolveBlockTime(api)

  return {
    urn: chainId,
    genesisHash: genesisHash.toHex(),
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
