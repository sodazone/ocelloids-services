import { firstValueFrom, Subject, Subscription, toArray } from 'rxjs'
import { asJSON } from '@/common/util.js'
import { networks } from '@/services/agents/common/networks.js'
import { AssetMetadata, isAssetMetadata } from '@/services/agents/steward/types.js'
import { IngressConsumers } from '@/services/ingress/index.js'
import { storageEntriesAtLatest$, XcmLocation } from '@/services/networking/substrate/index.js'
import { Logger } from '@/services/types.js'
import { DefiMonitorDependencies, DefiSubscriptionPayload } from '../../types.js'
import { AssetConversionPool, BaseAssetMetadata, PoolAssetsAssetValue } from './types.js'

const CHAIN_ID = networks.assetHub
const MAX_BATCH_SIZE = 50

function chunk<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = []
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size))
  }
  console.log('chunks', chunks)
  return chunks
}

function resolveToken(
  location: XcmLocation,
  metadataMap: Map<string, AssetMetadata>,
): BaseAssetMetadata | null {
  if (location.parents === 0 && location.interior.type === 'X2') {
    const assetIdJunction = location.interior.value.find((j) => j.type === 'GeneralIndex')

    if (!assetIdJunction) {
      return null
    }

    const assetId = Number(assetIdJunction.value)
    const metadata = metadataMap.get(String(assetId))

    return {
      chainId: CHAIN_ID,
      id: assetId,
      decimals: metadata?.decimals,
      symbol: metadata?.symbol,
    }
  }

  const metadata = metadataMap.get(asJSON(location))

  if (!metadata) {
    return null
  }

  return {
    chainId: CHAIN_ID,
    id: metadata.id,
    decimals: metadata.decimals,
    symbol: metadata.symbol,
  }
}

export function assethubDexMonitor(
  logger: Logger,
  _ingress: IngressConsumers,
  deps: DefiMonitorDependencies,
) {
  const subject = new Subject<DefiSubscriptionPayload>()
  const subs: Subscription[] = []
  const ingress = _ingress.substrate
  const poolMap = new Map<string, AssetConversionPool>()
  const tokenMetadataMap = new Map<string, AssetMetadata>()

  async function loadTokenMetadata(poolTokenLocations: [XcmLocation, XcmLocation][]) {
    try {
      const numericAssetIds = new Set<string>()
      const locationIds = new Set<string>()

      for (const [baseLocation, quoteLocation] of poolTokenLocations) {
        for (const location of [baseLocation, quoteLocation]) {
          if (location.parents === 0 && location.interior.type === 'X2') {
            const assetIdJunction = location.interior.value.find((j) => j.type === 'GeneralIndex')

            if (assetIdJunction) {
              numericAssetIds.add(String(assetIdJunction.value))
              continue
            }
          }

          locationIds.add(asJSON(location))
        }
      }

      const locationIdsList = [...locationIds]
      const numericAssetIdsList = [...numericAssetIds]

      const numericMetadata = await Promise.all(
        chunk(numericAssetIdsList, MAX_BATCH_SIZE).map((batch) => deps.fetchAssetMetadata(CHAIN_ID, batch)),
      ).then((results) => results.flat())

      const locationMetadata = await Promise.all(
        chunk(locationIdsList, MAX_BATCH_SIZE).map((batch) =>
          deps.fetchAssetMetadataByLocation(CHAIN_ID, batch),
        ),
      ).then((results) => results.flat())

      for (const metadata of numericMetadata) {
        tokenMetadataMap.set(String(metadata.id), metadata)
      }

      locationIdsList.forEach((location, i) => {
        const metadata = locationMetadata[i]
        if (isAssetMetadata(metadata)) {
          tokenMetadataMap.set(location, metadata)
        }
      })
    } catch (error) {
      logger.error(error, '[defi:assethub] Error loading asset metadata')
    }
  }

  async function start() {
    logger.info('[defi:assethub] starting monitor...')
    const [poolEntries, poolInfoEntries] = await Promise.all([
      firstValueFrom(
        storageEntriesAtLatest$<[[XcmLocation, XcmLocation]], number>(
          ingress,
          CHAIN_ID,
          'AssetConversion',
          'Pools',
        ).pipe(toArray()),
      ),
      firstValueFrom(
        storageEntriesAtLatest$<[number], PoolAssetsAssetValue>(
          ingress,
          CHAIN_ID,
          'PoolAssets',
          'Asset',
        ).pipe(toArray()),
      ),
    ])

    await loadTokenMetadata(poolEntries.map(({ key }) => key[0]))

    const poolInfoMap = new Map(poolInfoEntries.map((e) => [e.key[0], e.value]))

    for (const { key, value: poolTokenId } of poolEntries) {
      const [baseLocation, quoteLocation] = key[0]

      const baseToken = resolveToken(baseLocation, tokenMetadataMap)
      const quoteToken = resolveToken(quoteLocation, tokenMetadataMap)

      const poolInfo = poolInfoMap.get(poolTokenId)

      if (!baseToken || !quoteToken || !poolInfo) {
        continue
      }

      poolMap.set(String(poolTokenId), {
        chainId: CHAIN_ID,
        poolTokenId,
        owner: poolInfo.owner,
        baseToken,
        quoteToken,
      })
    }
    logger.info('[defi:assethub] monitor started.')
  }

  return {
    start,
    stop: () => {
      subs.forEach((s) => s.unsubscribe())
      subs.length = 0
    },
    chainId: CHAIN_ID,
    config: {
      evm: false,
      substrate: true,
    },
    events$: subject.asObservable(),
  }
}
