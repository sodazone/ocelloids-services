import {
  catchError,
  distinctUntilChanged,
  exhaustMap,
  filter,
  from,
  map,
  Observable,
  of,
  switchMap,
  tap,
  timer,
} from 'rxjs'
import { encodeFunctionData, erc20Abi } from 'viem'
import { IngressConsumers } from '@/services/ingress/index.js'
import { toFrontierRuntimeQuery } from '@/services/networking/substrate/evm/helpers.js'
import { isXcmLocation } from '@/services/networking/substrate/util.js'
import { HexString } from '@/services/subscriptions/types.js'
import { networks } from '../../common/networks.js'
import { AssetId } from '../../steward/types.js'
import { Binary } from 'polkadot-api'

const POLLING_INTERVAL = 60_000

type ForeignAssetaAssetStorageValue = {
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

export function remoteIssuanceMappers(
  ingress: IngressConsumers,
): Record<string, (ctx: { assetId: AssetId }) => Observable<bigint>> {
  return {
    [networks.assetHub]: ({ assetId }) => {
      const chainId = networks.assetHub
      if (!isXcmLocation(assetId)) {
        throw new Error(`[${chainId}] asset ID must be an XCM location object`)
      }
      return ingress.substrate.getContext(chainId).pipe(
        switchMap((apiCtx) => {
          const codec = apiCtx.storageCodec('ForeignAssets', 'Asset')
          const storageKey = codec.keys.enc(assetId) as HexString

          return timer(0, POLLING_INTERVAL).pipe(
            exhaustMap(() =>
              from(ingress.substrate.getStorage(chainId, storageKey)).pipe(
                catchError((err) => {
                  console.error(err, 'Error in Asset Hub ForeignAssets issuance mapper')
                  return of(null)
                }),
              ),
            ),
            filter((value) => value !== null),
            map((value) => {
              const { supply } = codec.value.dec(value) as ForeignAssetaAssetStorageValue
              return supply
            }),
            distinctUntilChanged(),
          )
        }),
      )
    },
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
        exhaustMap(() =>
          from(
            ingress.substrate.runtimeCall(
              chainId,
              {
                api,
                method,
              },
              args,
            ),
          ).pipe(
            catchError((err) => {
              console.error(err, 'Error in Moonbeam issuance mapper')
              return of(null)
            }),
          ),
        ),
        map(value => {
          if (typeof value === 'bigint') {
            return value
          } else if (value !== null && typeof value === 'object' && value.success && 'value' in value) {
            try {
              console.log('VALUE', value.value)
              const v = value.value.value as Binary
              const h = v.asHex()
              return BigInt(h === '0x' ? 0 : h)
            } catch (err) {
              console.warn(err, 'Balance extractor error in ethereumruntimerpcapi.call')
            }
          }
          return null
        }),
        filter((value) => value !== null),
        distinctUntilChanged(),
      )
    },
    [networks.hydration]: ({ assetId }) => {
      const chainId = networks.hydration

      if (typeof assetId !== 'number') {
        throw new Error(`[${chainId}] asset ID must be a number`)
      }

      return ingress.substrate.getContext(chainId).pipe(
        switchMap((apiCtx) => {
          const codec = apiCtx.storageCodec('Tokens', 'TotalIssuance')
          const storageKey = codec.keys.enc(assetId) as HexString

          return timer(0, POLLING_INTERVAL).pipe(
            exhaustMap(() =>
              from(ingress.substrate.getStorage(chainId, storageKey)).pipe(
                catchError((err) => {
                  console.error(err, 'Error in Hydration issuance mapper')
                  return of(null)
                }),
              ),
            ),
            filter((value) => value !== null),
            map((value) => codec.value.dec(value) as bigint),
            distinctUntilChanged(),
          )
        }),
      )
    },
  }
}
