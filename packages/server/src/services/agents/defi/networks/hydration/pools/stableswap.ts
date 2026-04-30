import { Binary, Enum, FixedSizeArray, FixedSizeBinary } from 'polkadot-api'
import { toHex } from 'polkadot-api/utils'
import { firstValueFrom, toArray } from 'rxjs'
import { toAssetId } from '@/services/agents/common/assets.js'
import { getStablePoolPublicKey } from '@/services/agents/common/hydration.js'
import { CustomDiscoveryFetcher } from '@/services/agents/steward/balances/types.js'
import { Block, storageEntriesAtLatest$ } from '@/services/networking/substrate/index.js'
import { SubstrateIngressConsumer } from '@/services/networking/substrate/ingress/types.js'
import { HexString } from '@/services/subscriptions/types.js'
import { CHAIN_ID } from '../consts.js'
import { AssetMetadataFetcher, Pool, PoolToken, StableSwapPool } from '../types.js'

type StablePoolValue = {
  assets: number[]
  final_amplification: number
  fee: number
  initial_amplification: number
  initial_block: number
  final_block: number
}

export type PoolPegInfo = {
  source: Enum<{
    Value: FixedSizeArray<2, bigint>
    Oracle: [
      FixedSizeBinary<8>,
      Enum<{
        LastBlock: undefined
        Short: undefined
        TenMinutes: undefined
        Hour: undefined
        Day: undefined
        Week: undefined
      }>,
      number,
    ]
    MMOracle: Binary
  }>[]
  updated_at: number
  max_peg_update: number
  current: FixedSizeArray<2, bigint>[]
}

function calculateAmplification({
  initialAmplification,
  finalAmplification,
  initialBlock,
  finalBlock,
  currentBlock,
}: {
  initialAmplification: bigint
  finalAmplification: bigint
  initialBlock: bigint
  finalBlock: bigint
  currentBlock: bigint
}): bigint {
  if (currentBlock < initialBlock || finalBlock <= initialBlock) {
    return initialAmplification
  }

  if (currentBlock >= finalBlock) {
    return finalAmplification
  }

  const absDiff =
    finalAmplification > initialAmplification
      ? finalAmplification - initialAmplification
      : initialAmplification - finalAmplification

  const elapsed = currentBlock - initialBlock
  const duration = finalBlock - initialBlock

  const step = (absDiff * elapsed) / duration

  if (finalAmplification > initialAmplification) {
    return initialAmplification + step
  } else {
    return initialAmplification - step
  }
}

function getRecentPegs(poolPegs: PoolPegInfo): string[][] {
  const { current } = poolPegs
  return Array.from(current.entries()).map(([_, pegs]) => pegs.map((p) => p.toString()))
}

function getDefaultPegs(size: number): string[][] {
  const pegs = []
  for (let i = 0; i < size; i++) {
    pegs.push(['1', '1'])
  }
  return pegs
}

export function createStableswapWatcher(
  ingress: SubstrateIngressConsumer,
  fetchBalances: CustomDiscoveryFetcher,
  fetchAssetMetadata: AssetMetadataFetcher,
) {
  async function mapPool({
    block,
    poolId,
    poolDetails,
    totalIssuance,
    pegs,
  }: {
    block: Block
    poolId: number
    poolDetails: StablePoolValue
    totalIssuance: bigint
    pegs?: PoolPegInfo
  }): Promise<StableSwapPool> {
    const { assets, fee, final_amplification, initial_amplification, initial_block, final_block } =
      poolDetails
    const address = toHex(getStablePoolPublicKey(poolId)) as HexString
    const amplification = calculateAmplification({
      initialAmplification: BigInt(initial_amplification),
      finalAmplification: BigInt(final_amplification),
      initialBlock: BigInt(initial_block),
      finalBlock: BigInt(final_block),
      currentBlock: BigInt(block.number),
    })
    const balances = await fetchBalances(address)
    const assetMetadata = await fetchAssetMetadata(assets.map((a) => a.toString()))

    const tokens: PoolToken[] = []

    for (const asset of assets) {
      const balance = balances.find((b) => b.assetId === asset)
      const reserves = balance?.balance ?? 0n
      const metadata = assetMetadata.find((a) => a.id === asset)

      tokens.push({
        id: toAssetId(CHAIN_ID, asset),
        reserves,
        decimals: metadata?.decimals ?? 0,
        symbol: metadata?.symbol,
      })
    }

    const poolPegs = pegs ? getRecentPegs(pegs) : getDefaultPegs(assets.length)

    return {
      type: 'stableswap',
      address,
      id: poolId,
      tokens,
      totalIssuance,
      amplification,
      pegs: poolPegs,
      fees: fee / 1_000_000,
    }
  }

  async function loadPools(block: Block): Promise<Pool[]> {
    const pools = await firstValueFrom(
      storageEntriesAtLatest$<HexString, StablePoolValue>(ingress, CHAIN_ID, 'Stableswap', 'Pools').pipe(
        toArray(),
      ),
    )

    const keysToPoolIdsMap = new Map(
      pools.map(({ key }) => {
        const bytes = Buffer.from(key.slice(2), 'hex')
        const poolId = bytes.readUInt32LE(0)
        return [key, poolId]
      }),
    )
    const poolIds = [...keysToPoolIdsMap.values()]

    const [tokenIssuances, poolPegs] = await Promise.all([
      firstValueFrom(
        storageEntriesAtLatest$<HexString, bigint>(
          ingress,
          CHAIN_ID,
          'Tokens',
          'TotalIssuance',
          poolIds,
        ).pipe(toArray()),
      ),
      firstValueFrom(
        storageEntriesAtLatest$<HexString, PoolPegInfo>(
          ingress,
          CHAIN_ID,
          'Stableswap',
          'PoolPegs',
          poolIds,
        ).pipe(toArray()),
      ),
    ])

    const stablePools: Pool[] = []

    for (const { key, value: poolDetails } of pools) {
      const poolId = keysToPoolIdsMap.get(key)
      if (poolId === undefined) {
        console.error(`Pool ID not found for key ${key}`)
        continue
      }
      try {
        const totalIssuance = tokenIssuances.find((iss) => iss.key === key)?.value
        if (totalIssuance === undefined) {
          console.error(`Issuance not found for stableswap pool ${poolId}`)
          continue
        }
        const pegs = poolPegs.find((p) => p.key === key)?.value
        const mapped = await mapPool({ poolId, poolDetails, totalIssuance, pegs, block })

        stablePools.push(mapped)
      } catch (error) {
        console.error(`Error loading stable pool ${key}`, (error as Error).message)
      }
    }
    return stablePools
  }

  async function getUpdatedPoolReserves(block: Block): Promise<Pool[]> {
    // add logic for updating already known pools
    return loadPools(block)
  }

  return {
    getUpdatedPoolReserves,
  }
}
