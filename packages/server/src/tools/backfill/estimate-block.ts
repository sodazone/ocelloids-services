#!/usr/bin/env node
import { Command } from 'commander'
import { pino } from 'pino'
import { firstValueFrom } from 'rxjs'
import { createPublicClient, http, PublicClient } from 'viem'
import { createSubstrateClient } from '@/services/networking/substrate/client.js'
import { getTimestampFromBlock, SubstrateApi } from '@/services/networking/substrate/index.js'

type ChainType = 'evm' | 'substrate'

type ChainConfig = {
  type: ChainType
  blockTime: number
  rpc: string
}

const CHAIN_CONFIG: Record<string, ChainConfig> = {
  eth: { type: 'evm', blockTime: 12, rpc: 'https://ethereum-rpc.publicnode.com' },
  op: { type: 'evm', blockTime: 2, rpc: 'https://mainnet.optimism.io' },
  base: { type: 'evm', blockTime: 2, rpc: 'https://base-public.nodies.app' },
  arb: { type: 'evm', blockTime: 0.25, rpc: 'https://arbitrum-one-public.nodies.app' },
  bsc: { type: 'evm', blockTime: 0.45, rpc: 'https://public-bsc-mainnet.fastnode.io' },
  dot: { type: 'substrate', blockTime: 6, rpc: 'wss://rpc.ibp.network/polkadot' },
  nexus: { type: 'substrate', blockTime: 6, rpc: 'wss://nexus.ibp.network' },
}

function isIsoDateString(value: string): boolean {
  if (typeof value !== 'string') {
    return false
  }

  const isoRegex = /^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})?)?$/

  if (!isoRegex.test(value)) {
    return false
  }
  return !Number.isNaN(new Date(value).getTime())
}

function toUnixSeconds(date: string): number {
  return Math.floor(new Date(date).getTime() / 1000)
}

async function binarySearchClosest(
  low: number,
  high: number,
  targetTs: number,
  getTimestampAt: (height: number) => Promise<number>,
): Promise<{ blockNumber: number; timestamp: number }> {
  let bestBlock = low
  let bestDiff = Infinity
  let newLow = low
  let newHigh = high

  while (newLow <= newHigh) {
    const mid = Math.floor((newLow + newHigh) / 2)
    const ts = await getTimestampAt(mid)
    const diff = Math.abs(ts - targetTs)

    if (diff < bestDiff) {
      bestDiff = diff
      bestBlock = mid
    }

    if (ts < targetTs) {
      newLow = mid + 1
    } else if (ts > targetTs) {
      newHigh = mid - 1
    } else {
      return { blockNumber: mid, timestamp: ts }
    }

    if (bestDiff <= 1) {
      break
    }
  }

  const ts = await getTimestampAt(bestBlock)
  return { blockNumber: bestBlock, timestamp: ts }
}

async function getSubstrateTimestampAt(client: SubstrateApi, height: number): Promise<number> {
  const hash = await client.getBlockHash(height)
  const block = await client.getBlock(hash)
  const tsMs = getTimestampFromBlock(block.extrinsics)

  if (!tsMs) {
    throw new Error(`No timestamp at block ${height}`)
  }

  return Math.floor(tsMs / 1000)
}

async function estimateSubstrateBlockAtTime(client: SubstrateApi, targetTs: number, avgBlockTimeSec: number) {
  const head = await firstValueFrom(client.followHeads$('finalized'))
  const latestHeight = head.height
  const latestTs = await getSubstrateTimestampAt(client, latestHeight)

  const rough = latestHeight + Math.round((targetTs - latestTs) / avgBlockTimeSec)

  const RANGE = 1000

  return binarySearchClosest(
    Math.max(0, rough - RANGE),
    Math.min(rough + RANGE, latestHeight),
    targetTs,
    (height) => getSubstrateTimestampAt(client, height),
  )
}

async function estimateEvmBlockAtTime(client: PublicClient, targetTs: number, avgBlockTimeSec: number) {
  const latest = await client.getBlock()
  const latestHeight = Number(latest.number)
  const latestTs = Number(latest.timestamp)

  const rough = latestHeight + Math.round((targetTs - latestTs) / avgBlockTimeSec)

  const RANGE = 1000

  return binarySearchClosest(
    Math.max(0, rough - RANGE),
    Math.min(rough + RANGE, latestHeight),
    targetTs,
    async (height) => {
      const block = await client.getBlock({ blockNumber: BigInt(height) })
      return Number(block.timestamp)
    },
  )
}

async function estimateBlockAtTime(chain: string, targetDateTime: string) {
  const config = CHAIN_CONFIG[chain]
  if (!config) {
    throw new Error(`Chain not configured: ${chain}`)
  }

  const targetTs = toUnixSeconds(targetDateTime)
  let estimate: {
    blockNumber: number
    timestamp: number
  }
  if (config.type === 'evm') {
    const client = createPublicClient({ transport: http(config.rpc) })
    estimate = await estimateEvmBlockAtTime(client, targetTs, config.blockTime)
  } else {
    const client = await createSubstrateClient(pino(), chain, config.rpc)
    estimate = await estimateSubstrateBlockAtTime(client, targetTs, config.blockTime)
  }

  console.log('----', chain.toUpperCase())
  console.log('Refined block:', estimate.blockNumber)
  console.log('Block timestamp:', new Date(estimate.timestamp * 1000).toUTCString())
  console.log('Difference (seconds):', Math.abs(estimate.timestamp - targetTs))
}

const program = new Command()

program
  .name('block-estimator')
  .description('Estimate block at a given date-time')
  .requiredOption('-t, --target <datetime>', 'Target date-time (ISO 8601)')
  .requiredOption('-c, --chain <chain>', 'Chain name | all')
  .parse(process.argv)

const { target, chain } = program.opts()

async function main() {
  if (!isIsoDateString(target)) {
    throw new Error('Target datetime not valid')
  }
  if (new Date(target).getTime() > Date.now()) {
    throw new Error(`Target datetime is in the future. Current time: ${new Date().toISOString()}`)
  }

  if (chain === 'all') {
    const chains = Object.keys(CHAIN_CONFIG)
    for (const c of chains) {
      try {
        await estimateBlockAtTime(c.toLowerCase(), target)
      } catch (err: any) {
        console.error(`Error (${c.toUpperCase()}):`, err.message)
      }
    }
  } else {
    try {
      await estimateBlockAtTime(chain.toLowerCase(), target)
    } catch (err: any) {
      console.error('Error:', err.message, chain)
    }
  }
  process.exit()
}

try {
  await main()
} catch (err: any) {
  console.error('Error:', err.message)
}
