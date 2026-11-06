import { catchError, EMPTY, forkJoin, map, Observable, switchMap, take, timeout } from 'rxjs'
import { retryWithTruncatedExpBackoff } from '@/common/index.js'
import { toMelbourne } from '@/services/agents/common/melbourne.js'
import { getBalanceExtractor } from '@/services/networking/substrate/balances.js'
import { SubstrateIngressConsumer } from '@/services/networking/substrate/ingress/types.js'
import { Block, StorageChangeSets, SubstrateApiContext } from '@/services/networking/substrate/types.js'
import { HexString } from '@/services/subscriptions/types.js'
import { Logger } from '@/services/types.js'
import { chunk } from '../../common.js'
import { CHAIN_ID, MAX_BATCH_SIZE } from './common.js'
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
    const entries = [...buildStorageQueries(apiCtx, poolMap).entries()]
    const byStorageKey = new Map(entries.map(([cacheKey, query]) => [query.storageKey, { cacheKey, query }]))
    const chunks = chunk(entries, MAX_BATCH_SIZE)

    const query$ = (block: Block) =>
      forkJoin(
        chunks.map((c) =>
          ingress
            .queryStorageAt(
              CHAIN_ID,
              c.map(([, q]) => q.storageKey),
              block.hash as HexString,
            )
            .pipe(
              take(1),
              timeout(5_000),
              retryWithTruncatedExpBackoff({ baseDelay: 100, maxDelay: 1_000, maxCount: 1 }),
            ),
        ),
      ).pipe(
        map((changeSets) => buildReserves(changeSets, byStorageKey, apiCtx, poolMap)),
        catchError((err) => {
          logger.error(err, '[defi:assethub] reserves query failed at %s', block.hash)
          return EMPTY
        }),
      )

    return (source$: Observable<Block>) => source$.pipe(switchMap(query$))
  }

  function buildReserves(
    changeSets: StorageChangeSets[],
    byStorageKey: Map<string, { cacheKey: string; query: { pallet: string; name: string } }>,
    apiCtx: SubstrateApiContext,
    poolMap: Map<string, AssetConversionPool>,
  ) {
    const balanceMap = new Map<string, bigint>()

    for (const cs of changeSets) {
      for (const [key, value] of cs[0].changes) {
        const hit = byStorageKey.get(key)
        if (!value || !hit) {
          continue
        }

        const { cacheKey, query } = hit
        const raw = apiCtx.storageCodec(query.pallet, query.name).value.dec(value)
        const extract = getBalanceExtractor(query.pallet, query.name)
        balanceMap.set(cacheKey, extract ? extract(raw) : 0n)
      }
    }

    const poolReservesMap = new Map<string, AssetConversionPoolReserves>()
    for (const [poolKey, pool] of poolMap) {
      const base = balanceMap.get(makeBalanceKey('System', 'native', pool.owner))
      const quote =
        pool.quoteToken.type === 'local'
          ? balanceMap.get(makeBalanceKey('Assets', String(pool.quoteToken.id), pool.owner))
          : balanceMap.get(makeBalanceKey('ForeignAssets', toMelbourne(pool.quoteToken.id), pool.owner))

      if (base === undefined || quote === undefined) {
        continue
      }

      poolReservesMap.set(poolKey, {
        ...pool,
        baseToken: { ...pool.baseToken, reserves: base },
        quoteToken: { ...pool.quoteToken, reserves: quote },
      })
    }
    return poolReservesMap
  }

  return {
    mapReserves,
  }
}
