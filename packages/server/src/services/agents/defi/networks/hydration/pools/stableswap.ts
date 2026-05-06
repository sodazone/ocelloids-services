import { Binary, Enum, FixedSizeArray, FixedSizeBinary } from 'polkadot-api'
import { toHex } from 'polkadot-api/utils'
import { firstValueFrom, toArray } from 'rxjs'
import { getStablePoolPublicKey } from '@/services/agents/common/hydration.js'
import { CustomDiscoveryFetcher } from '@/services/agents/steward/balances/types.js'
import { Block, storageEntriesAtLatest$ } from '@/services/networking/substrate/index.js'
import { SubstrateIngressConsumer } from '@/services/networking/substrate/ingress/types.js'
import { HexString } from '@/services/subscriptions/types.js'
import { CHAIN_ID } from '../consts.js'
import { AssetMetadataFetcher, Peg, PoolToken, StableSwapPool } from '../types.js'

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

function getRecentPegs(poolPegs: PoolPegInfo): Peg[] {
  const { current } = poolPegs
  return Array.from(current.entries()).map(([_, pegs]) => [pegs[0], pegs[1]])
}

function getDefaultPegs(size: number): Peg[] {
  const pegs: Peg[] = []
  for (let i = 0; i < size; i++) {
    pegs.push([1n, 1n])
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
    const isRampPeriod = block.number >= initial_block && block.number < final_block
    const balances = await fetchBalances(address)
    const assetMetadata = await fetchAssetMetadata([...assets.map((a) => a.toString()), poolId.toString()])
    const sharesMetadata = assetMetadata.find((m) => m.id === poolId)

    const tokens: PoolToken[] = []

    for (const asset of assets) {
      const balance = balances.find((b) => b.assetId === asset)
      const reserves = balance?.balance ?? 0n
      const metadata = assetMetadata.find((a) => a.id === asset)

      tokens.push({
        id: asset,
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
      fees: fee,
      isRampPeriod,
      sharesDecimals: sharesMetadata?.decimals ?? 0,
      sharesSymbol: sharesMetadata?.symbol,
    }
  }

  async function loadPools(block: Block): Promise<StableSwapPool[]> {
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

    const stablePools: StableSwapPool[] = []

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

  async function updatePoolReserves(pools: StableSwapPool[], block: Block): Promise<StableSwapPool[]> {
    const updatedPools: StableSwapPool[] = []
    for (const pool of pools) {
      try {
        const { address, id, tokens } = pool

        const balances = await fetchBalances(address)
        const [totalIssuance, pegs] = await Promise.all([
          ingress.query<bigint>(
            CHAIN_ID,
            {
              module: 'Tokens',
              method: 'TotalIssuance',
            },
            id,
          ),
          ingress.query<PoolPegInfo>(CHAIN_ID, {
            module: 'Stableswap',
            method: 'PoolPegs',
          }),
        ])

        if (!totalIssuance) {
          console.error(`Issuance not found for stableswap pool ${id}`)
          continue
        }

        const poolPegs = pegs ? getRecentPegs(pegs) : getDefaultPegs(tokens.length)

        const updatedTokens: PoolToken[] = []

        for (const t of tokens) {
          const balance = balances.find((b) => b.assetId === t.id)
          const reserves = balance?.balance ?? 0n

          updatedTokens.push({
            ...t,
            reserves,
          })
        }

        updatedPools.push({
          ...pool,
          totalIssuance,
          pegs: poolPegs,
          tokens: updatedTokens,
        })
      } catch (err) {
        console.error(err, `Unable to update stableswap pool ${pool.id}`)
        updatedPools.push(pool)
      }
    }
    return updatedPools
  }

  return {
    updatePoolReserves,
    loadPools,
  }
}
