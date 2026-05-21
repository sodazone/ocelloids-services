import { distinctUntilChanged, filter, forkJoin, from, map, Observable, switchMap, timer } from 'rxjs'
import { encodeFunctionData, erc20Abi } from 'viem'
import { retryWithTruncatedExpBackoff } from '@/common/index.js'
import { NetworkURN } from '@/lib.js'
import { IngressConsumers } from '@/services/ingress/index.js'
import { extractEthereumRuntimeRpcCallBalance } from '@/services/networking/substrate/balances.js'
import { serializeStorageKeyArg } from '@/services/networking/substrate/common/storage.js'
import { toFrontierRuntimeQuery } from '@/services/networking/substrate/evm/helpers.js'
import { SubstrateIngressConsumer } from '@/services/networking/substrate/ingress/types.js'
import { isXcmLocation } from '@/services/networking/substrate/util.js'
import { RETRY_INFINITE } from '@/services/networking/watcher.js'
import { HexString } from '@/services/subscriptions/types.js'
import { networks } from '../../common/networks.js'
import { AssetId } from '../../steward/types.js'

const POLLING_INTERVAL = 60_000

type AssetsAssetStorageValue = {
  owner: string
  issuer: string
  admin: string
  freezer: string
  supply: bigint
  deposit: bigint
  min_balance: bigint
  is_sufficient: boolean
  accounts: number
  sufficients: number
  approvals: number
  status: Record<string, any>
}

type SystemStakingConfig = {
  exec_delay: number
  system_stakable_base: bigint
}

type SystemStakingTokenStatus = {
  system_stakable_amount: bigint
  system_shadow_amount: bigint
  pending_redeem_amount: bigint
  current_config: SystemStakingConfig
  new_config: SystemStakingConfig
}

function foreignAssetsIssuance$(ingress: SubstrateIngressConsumer, chainId: NetworkURN, assetId: AssetId) {
  if (!isXcmLocation(assetId)) {
    throw new Error(`[${chainId}] asset ID must be an XCM location object`)
  }
  return ingress.getContext(chainId).pipe(
    switchMap((apiCtx) => {
      const codec = apiCtx.storageCodec('ForeignAssets', 'Asset')
      const storageKey = codec.keys.enc(serializeStorageKeyArg(assetId)) as HexString

      return timer(0, POLLING_INTERVAL).pipe(
        switchMap(() => ingress.getStorage(chainId, storageKey)),
        filter((value) => value !== null),
        map((value) => {
          const { supply } = codec.value.dec(value) as AssetsAssetStorageValue
          return supply
        }),
        distinctUntilChanged(),
      )
    }),
  )
}

function tokensIssuance$(ingress: SubstrateIngressConsumer, chainId: NetworkURN, assetId: AssetId) {
  return ingress.getContext(chainId).pipe(
    switchMap((apiCtx) => {
      const codec = apiCtx.storageCodec('Tokens', 'TotalIssuance')
      const storageKey = codec.keys.enc(assetId) as HexString

      return timer(0, POLLING_INTERVAL).pipe(
        switchMap(() => ingress.getStorage(chainId, storageKey)),
        filter((value) => value !== null),
        map((value) => codec.value.dec(value) as bigint),
        distinctUntilChanged(),
      )
    }),
  )
}

function bifrostIssuance$(ingress: SubstrateIngressConsumer, chainId: NetworkURN, assetId: AssetId) {
  return ingress.getContext(chainId).pipe(
    switchMap((apiCtx) => {
      const tokensCodec = apiCtx.storageCodec('Tokens', 'TotalIssuance')
      const stakingCodec = apiCtx.storageCodec('SystemStaking', 'TokenStatus')

      const tokensStorageKey = tokensCodec.keys.enc(assetId) as HexString
      const stakingStorageKey = stakingCodec.keys.enc(assetId) as HexString

      return timer(0, POLLING_INTERVAL).pipe(
        switchMap(() =>
          forkJoin({
            tokens: ingress.getStorage(chainId, tokensStorageKey),
            staking: ingress.getStorage(chainId, stakingStorageKey),
          }),
        ),
        map(({ tokens, staking }) => {
          if (tokens === null) {
            return null
          }

          const totalIssuance = tokensCodec.value.dec(tokens) as bigint

          if (staking === null) {
            return totalIssuance
          }

          const stakingStatus = stakingCodec.value.dec(staking) as SystemStakingTokenStatus
          const shadowIssuance: bigint = stakingStatus.system_shadow_amount

          return totalIssuance - shadowIssuance
        }),
        filter((v): v is bigint => v !== null),
        distinctUntilChanged(),
      )
    }),
  )
}

export function remoteIssuanceMappers(
  ingress: IngressConsumers,
): Record<string, (ctx: { assetId: AssetId }) => Observable<bigint>> {
  return {
    [networks.assetHub]: ({ assetId }) =>
      foreignAssetsIssuance$(ingress.substrate, networks.assetHub, assetId),
    [networks.kusamaAssetHub]: ({ assetId }) =>
      foreignAssetsIssuance$(ingress.substrate, networks.kusamaAssetHub, assetId),
    [networks.moonbeam]: ({ assetId }) => {
      const chainId = networks.moonbeam

      if (typeof assetId !== 'string' || !assetId.startsWith('0x')) {
        throw new Error(`[${chainId}] asset ID must be a hex string`)
      }

      const callData = encodeFunctionData({
        abi: erc20Abi,
        functionName: 'totalSupply',
        args: [],
      })
      const { api, method, args } = toFrontierRuntimeQuery({
        callData,
        contractAddress: assetId as HexString,
      })

      return timer(0, POLLING_INTERVAL).pipe(
        switchMap(() =>
          from(
            ingress.substrate.runtimeCall(
              chainId,
              {
                api,
                method,
              },
              args,
            ),
          ).pipe(retryWithTruncatedExpBackoff(RETRY_INFINITE)),
        ),
        map(extractEthereumRuntimeRpcCallBalance),
        filter((value) => value !== null),
        distinctUntilChanged(),
      )
    },
    [networks.astar]: ({ assetId }) => {
      const chainId = networks.astar

      if (typeof assetId !== 'string') {
        throw new Error(`[${chainId}] asset ID must be a string`)
      }

      return ingress.substrate.getContext(chainId).pipe(
        switchMap((apiCtx) => {
          const codec = apiCtx.storageCodec('Assets', 'Asset')
          const storageKey = codec.keys.enc(BigInt(assetId)) as HexString

          return timer(0, POLLING_INTERVAL).pipe(
            switchMap(() => ingress.substrate.getStorage(chainId, storageKey)),
            filter((value) => value !== null),
            map((value) => {
              const { supply } = codec.value.dec(value) as AssetsAssetStorageValue
              return supply
            }),
            distinctUntilChanged(),
          )
        }),
      )
    },
    [networks.bifrost]: ({ assetId }) => {
      const chainId = networks.bifrost

      if (typeof assetId !== 'object') {
        throw new Error(`[${chainId}] asset ID must be an object`)
      }

      return bifrostIssuance$(ingress.substrate, chainId, assetId)
    },
    [networks.hydration]: ({ assetId }) => {
      const chainId = networks.hydration

      if (typeof assetId !== 'number') {
        throw new Error(`[${chainId}] asset ID must be a number`)
      }

      return tokensIssuance$(ingress.substrate, chainId, assetId)
    },
    [networks.ethereum]: ({ assetId }) => {
      const chainId = networks.ethereum

      if (typeof assetId === 'string' && assetId.startsWith('0x')) {
        const callData = {
          address: assetId as HexString,
          abi: erc20Abi,
          functionName: 'totalSupply',
          args: [],
        }

        return timer(0, POLLING_INTERVAL).pipe(
          switchMap(() =>
            from(ingress.evm.readContract<bigint>(chainId, callData)).pipe(
              retryWithTruncatedExpBackoff(RETRY_INFINITE),
            ),
          ),
          filter((value): value is bigint => value !== null),
          distinctUntilChanged(),
        )
      }

      throw new Error(`Unknown Ethereum asset type ${assetId}`)
    },
  }
}
