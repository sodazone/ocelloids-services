import { firstValueFrom, from, map, mergeMap, Observable } from 'rxjs'
import { toMelbourne } from '@/services/agents/common/melbourne.js'
import { getBalanceExtractor } from '@/services/networking/substrate/balances.js'
import { SubstrateIngressConsumer } from '@/services/networking/substrate/ingress/types.js'
import { Block, SubstrateApiContext } from '@/services/networking/substrate/types.js'
import { HexString } from '@/services/subscriptions/types.js'
import { Logger } from '@/services/types.js'
import { CHAIN_ID, chunk, MAX_BATCH_SIZE } from './common.js'
import { AssetConversionPool, AssetConversionPoolReserves } from './types.js'

function makeBalanceKey(pallet: 'System' | 'Assets' | 'ForeignAssets', assetId: string, account: string) {
  return `${pallet.toLowerCase()}:${assetId.toLowerCase() ?? ''}:${account}`
}

export function createReservesWatcher(logger: Logger, ingress: SubstrateIngressConsumer) {
  function buildStorageQueries(apiCtx: SubstrateApiContext, poolMap: Map<string, AssetConversionPool>) {
    const systemCodec = apiCtx.storageCodec('System', 'Account')
    const assetsCodec = apiCtx.storageCodec('Assets', 'Account')
    const foreignCodec = apiCtx.storageCodec('ForeignAssets', 'Account')

    const queries = new Map<
      string,
      {
        pallet: string
        name: string
        storageKey: HexString
      }
    >()

    for (const pool of poolMap.values()) {
      try {
        const owner = pool.owner
        const systemKey = makeBalanceKey('System', 'native', owner)

        if (!queries.has(systemKey)) {
          queries.set(systemKey, {
            pallet: 'System',
            name: 'Account',
            storageKey: systemCodec.keys.enc(owner) as HexString,
          })
        }

        if (pool.quoteToken.type === 'local') {
          const key = makeBalanceKey('Assets', String(pool.quoteToken.id), owner)

          if (!queries.has(key)) {
            queries.set(key, {
              pallet: 'Assets',
              name: 'Account',
              storageKey: assetsCodec.keys.enc(pool.quoteToken.id, owner) as HexString,
            })
          }
        } else {
          const key = makeBalanceKey('ForeignAssets', toMelbourne(pool.quoteToken.id), owner)

          if (!queries.has(key)) {
            queries.set(key, {
              pallet: 'ForeignAssets',
              name: 'Account',
              storageKey: foreignCodec.keys.enc(pool.quoteToken.location, owner) as HexString,
            })
          }
        }
      } catch (error) {
        logger.error(error, '[defi:assethub] error creating query for token %o', pool.quoteToken.location)
      }
    }

    return queries
  }

  function mapReserves(apiCtx: SubstrateApiContext, poolMap: Map<string, AssetConversionPool>) {
    return (source$: Observable<Block>): Observable<Map<string, AssetConversionPoolReserves>> =>
      source$.pipe(
        mergeMap((block) => {
          const queries = buildStorageQueries(apiCtx, poolMap)
          const entries = [...queries.entries()]
          const chunks = chunk(entries, MAX_BATCH_SIZE)

          const requests = Promise.all(
            chunks.flatMap((chunkEntries) => {
              const keys = chunkEntries.map(([, q]) => q.storageKey)

              return firstValueFrom(ingress.queryStorageAt(CHAIN_ID, keys, block.hash as HexString))
            }),
          )
          return from(requests).pipe(
            // retries and catch error
            map((changeSets) => {
              const balanceMap = new Map<string, bigint>(
                changeSets.flatMap((cs) =>
                  cs[0].changes
                    .map(([key, value]) => {
                      const entry = entries.find(([_, entry]) => entry.storageKey === key)

                      if (!value || !entry) {
                        return null
                      }

                      const [cacheKey, query] = entry

                      const codec = apiCtx.storageCodec(query.pallet, query.name)
                      const raw = codec.value.dec(value)
                      const balanceExtractor = getBalanceExtractor(query.pallet, query.name)

                      if (!balanceExtractor) {
                        return [cacheKey, 0n] as [string, bigint]
                      }

                      const freeBal = balanceExtractor(raw)

                      return [cacheKey, freeBal] as [string, bigint]
                    })
                    .filter((i) => i !== null),
                ),
              )

              const poolReservesMap = new Map<string, AssetConversionPoolReserves>()

              for (const [poolKey, pool] of poolMap) {
                const { baseToken, quoteToken } = pool
                const baseTokenBalance = balanceMap.get(makeBalanceKey('System', 'native', pool.owner))

                const quoteTokenBalance =
                  pool.quoteToken.type === 'local'
                    ? balanceMap.get(makeBalanceKey('Assets', String(pool.quoteToken.id), pool.owner))
                    : balanceMap.get(
                        makeBalanceKey('ForeignAssets', toMelbourne(pool.quoteToken.id), pool.owner),
                      )
                if (baseTokenBalance === undefined || quoteTokenBalance === undefined) {
                  continue
                }

                poolReservesMap.set(poolKey, {
                  ...pool,
                  baseToken: {
                    ...baseToken,
                    reserves: baseTokenBalance,
                  },
                  quoteToken: {
                    ...quoteToken,
                    reserves: quoteTokenBalance,
                  },
                })
              }

              return poolReservesMap
            }),
          )
        }),
      )
  }

  return {
    mapReserves,
  }
}
