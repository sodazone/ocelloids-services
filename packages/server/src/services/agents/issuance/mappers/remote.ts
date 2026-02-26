import { distinctUntilChanged, exhaustMap, filter, map, Observable, switchMap, timer } from 'rxjs'
import { encodeFunctionData, erc20Abi } from 'viem'
import { IngressConsumers } from '@/services/ingress/index.js'
import { toFrontierRuntimeQuery } from '@/services/networking/substrate/evm/helpers.js'
import { HexString } from '@/services/subscriptions/types.js'
import { networks } from '../../common/networks.js'
import { AssetId } from '../../steward/types.js'

const POLLING_INTERVAL = 60_000

export function remoteIssuanceMappers(
  ingress: IngressConsumers,
): Record<string, (ctx: { assetId: AssetId }) => Observable<bigint>> {
  return {
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
          ingress.substrate.runtimeCall<bigint>(
            chainId,
            {
              api,
              method,
            },
            args,
          ),
        ),
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
            exhaustMap(() => ingress.substrate.getStorage(chainId, storageKey)),
            map((value) => codec.value.dec(value) as bigint),
            distinctUntilChanged(),
          )
        }),
      )
    },
  }
}
