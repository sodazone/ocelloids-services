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

const LOW_LIQUIDITY_POOLS: HexString[] = [
  '0x22bb00df7706a5965728b60f96406ee59ce675fd5fd10652a4ed6f618856ccfe', // 4-pool
  '0xaffeef2e0ccac1986d8ac3b557e1e0d682d649bf61aee81e1a7faaab7eae35e0', // iBTC-WBTC
]

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

    const tokens: PoolToken[] = [
      {
        id: poolId,
        reserves: totalIssuance,
        decimals: sharesMetadata?.decimals ?? 0,
        symbol: sharesMetadata?.symbol,
      },
    ]

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
      amplification,
      pegs: poolPegs,
      fees: fee,
      isRampPeriod,
      isLowLiquidity: LOW_LIQUIDITY_POOLS.includes(address),
    }
  }

  async function loadPools(block: Block): Promise<StableSwapPool[]> {
    const pools = await firstValueFrom(
      storageEntriesAtLatest$<[number], StablePoolValue>(ingress, CHAIN_ID, 'Stableswap', 'Pools').pipe(
        toArray(),
      ),
    )

    const poolIds = pools.map(({ key }) => key[0])

    const [tokenIssuances, poolPegs] = await Promise.all([
      firstValueFrom(
        storageEntriesAtLatest$<[number], bigint>(ingress, CHAIN_ID, 'Tokens', 'TotalIssuance', poolIds).pipe(
          toArray(),
        ),
      ),
      firstValueFrom(
        storageEntriesAtLatest$<[number], PoolPegInfo>(
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
      const poolId = key[0]
      try {
        const totalIssuance = tokenIssuances.find((iss) => iss.key[0] === poolId)?.value
        if (totalIssuance === undefined) {
          console.error(`Issuance not found for stableswap pool ${poolId} on initalise`)
          continue
        }
        const pegs = poolPegs.find((p) => p.key[0] === poolId)?.value
        const mapped = await mapPool({ poolId, poolDetails, totalIssuance, pegs, block })

        stablePools.push(mapped)
      } catch (error) {
        console.error(`Error loading stable pool ${key}`, (error as Error).message)
      }
    }
    return stablePools
  }

  async function updatePoolReserves(pools: StableSwapPool[], _block: Block): Promise<StableSwapPool[]> {
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
          ingress.query<PoolPegInfo>(
            CHAIN_ID,
            {
              module: 'Stableswap',
              method: 'PoolPegs',
            },
            id,
          ),
        ])

        if (!totalIssuance) {
          console.error(`Issuance not found for stableswap pool ${id} on update`)
          continue
        }

        const poolPegs = pegs ? getRecentPegs(pegs) : getDefaultPegs(tokens.length - 1) // use tokens length - 1 since tokens also includes share token

        const updatedTokens: PoolToken[] = []

        for (const t of tokens) {
          if (t.id === id) {
            updatedTokens.push({
              ...t,
              reserves: totalIssuance,
            })
            continue
          }
          const balance = balances.find((b) => b.assetId === t.id)
          const reserves = balance?.balance ?? 0n

          updatedTokens.push({
            ...t,
            reserves,
          })
        }

        updatedPools.push({
          ...pool,
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
