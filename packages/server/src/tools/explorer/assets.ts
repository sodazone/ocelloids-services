import path from 'path'

import { CrosschainRepository } from '@/services/agents/crosschain/index.js'
import { createCrosschainDatabase } from '@/services/agents/crosschain/repositories/db.js'

type TokenInfo = {
  symbol: string
  decimals: number
  isNative?: boolean
}

const TOKEN_REGISTRY: Record<string, TokenInfo> = {
  ['1:so11111111111111111111111111111111111111112']: {
    symbol: 'WSOL',
    decimals: 9,
    isNative: false,
  },
  ['1:epjfwdd5aufqssqem2qn1xzybapc8g4weggkzwytdt1v']: {
    symbol: 'USDC',
    decimals: 6,
    isNative: false,
  },
  ['1:j1toso1uck3rlmjorhttrvwy9hj7x8v9yyac6y7kgcpn']: {
    symbol: 'JitoSOL',
    decimals: 9,
    isNative: false,
  },
  ['2:0xa3931d71877c0e7a3148cb7eb4463524fec27fbd']: {
    symbol: 'sUSDS',
    decimals: 18,
    isNative: false,
  },
  ['2:0xdac17f958d2ee523a2206206994597c13d831ec7']: {
    symbol: 'USDT',
    decimals: 6,
    isNative: false,
  },
  ['2:0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2']: {
    symbol: 'WETH',
    decimals: 18,
    isNative: false,
  },
  ['2:0x2260fac5e5542a773aa44fbcfedf7c193bc2c599']: {
    symbol: 'WBTC',
    decimals: 8,
    isNative: false,
  },
  ['2:0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48']: {
    symbol: 'USDC',
    decimals: 6,
    isNative: false,
  },
  ['2:0x6b175474e89094c44da98b954eedeac495271d0f']: {
    symbol: 'DAI',
    decimals: 18,
    isNative: false,
  },
  ['2:0xaa7a9ca87d3694b5755f213b5d04094b8d0f0a6f']: {
    symbol: 'TRAC',
    decimals: 18,
    isNative: false,
  },
  ['2:0x7de91b204c1c737bcee6f000aaa6569cf7061cb7']: {
    symbol: 'XRT',
    decimals: 9,
    isNative: false,
  },
  ['2:0x45804880de22913dafe09f4980848ece6ecbaf78']: {
    symbol: 'PAXG',
    decimals: 18,
    isNative: false,
  },
  ['2:0x57e114b691db790c35207b2e685d4a43181e6061']: {
    symbol: 'ENA',
    decimals: 18,
    isNative: false,
  },
  ['2:0x769916A66fDAC0E3D57363129caac59386ea622B']: {
    symbol: 'TEER',
    decimals: 12,
    isNative: false,
  },
  ['2:0x196c20da81fbc324ecdf55501e95ce9f0bd84d14']: {
    symbol: 'DOT',
    decimals: 10,
    isNative: false,
  },
  ['2:0xcccccccccc33d538dbc2ee4feab0a7a1ff4e8a94']: {
    symbol: 'CFG',
    decimals: 18,
    isNative: false,
  },
  ['4:0xbb4cdb9cbd36b01bd1cbaebf2de08d9173bc095c']: {
    symbol: 'WBNB',
    decimals: 18,
    isNative: true,
  },
  ['4:0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d']: {
    symbol: 'USDC',
    decimals: 18,
    isNative: false,
  },
  ['5:0x2791bca1f2de4661ed88a30c99a7a9449aa84174']: {
    symbol: 'USDC.e',
    decimals: 6,
    isNative: false,
  },
  ['5:0x0d500b1d8e8ef31e21c99d1db9a6444d3adf1270']: {
    symbol: 'WPOL',
    decimals: 18,
    isNative: false,
  },
  ['6:0xb31f66aa3c1e785363f0875a1b74e27b85fd66c7']: {
    symbol: 'WAVAX',
    decimals: 18,
    isNative: false,
  },
  ['6:0xb97ef9ef8734c71904d8002f8b6bc66dd9c48a6e']: {
    symbol: 'USDC',
    decimals: 6,
    isNative: false,
  },
  ['16:0xacc15dc74880c9944775448304b263d191c6077f']: {
    symbol: 'WGLMR',
    decimals: 18,
    isNative: false,
  },
  ['16:0x511ab53f793683763e5a8829738301368a2411e3']: {
    symbol: 'WELL',
    decimals: 18,
    isNative: false,
  },
  ['16:0x3405a1bd46b85c5c029483fbecf2f3e611026e45']: {
    symbol: 'MATIC',
    decimals: 18,
    isNative: false,
  },
  ['16:0xffffffffb3229c8e7657eabea704d5e75246e544']: {
    symbol: 'xcNEURO',
    decimals: 12,
    isNative: false,
  },
  ['21:0x9258181f5ceac8dbffb7030890243caed69a9599d2886d957a9cb7656af3bdb3']: {
    symbol: 'WSUI',
    decimals: 9,
    isNative: false,
  },
  ['22:0xa867703f5395cb2965feb7ebff5cdf39b771fc6156085da3ae4147a00be91b38']: {
    symbol: 'APT',
    decimals: 8,
    isNative: false,
  },
  ['24:0x0b2c639c533813f4aa9d7837caf62653d097ff85']: {
    symbol: 'USDC',
    decimals: 6,
    isNative: false,
  },
  ['30:0xa88594d404727625a9437c3f886c7643872296ae']: {
    symbol: 'WELL',
    decimals: 18,
    isNative: false,
  },
  ['30:0x833589fcd6edb6e08f4c7c32d4f71b54bda02913']: {
    symbol: 'USDC',
    decimals: 6,
    isNative: false,
  },
}

const WormholeChainIds: Record<string, number> = {
  'urn:ocn:solana:101': 1,
  'urn:ocn:polkadot:2004': 16,
  'urn:ocn:ethereum:56': 4,
  'urn:ocn:ethereum:137': 5,
  'urn:ocn:ethereum:1': 2,
  'urn:ocn:ethereum:10': 24,
  'urn:ocn:ethereum:42161': 23,
  'urn:ocn:ethereum:8453': 30,
  'urn:ocn:ethereum:42220': 14,
  'urn:ocn:ethereum:43114': 6,
  'urn:ocn:sui:0x35834a8a': 21,
} as const
// ----------------------------------------------------------------

function assetToRegistryKey(asset: string): string | null {
  const [networkURN, assetId] = asset.split('|')
  if (!networkURN || !assetId || assetId.startsWith('{')) {
    return null
  }

  const chainId = WormholeChainIds[networkURN]
  if (!chainId) {
    return null
  }

  return `${chainId}:${assetId.toLowerCase()}`
}

async function main() {
  const dbPathArg = process.argv[2]
  if (!dbPathArg) {
    console.error('Usage: node assets.js <path-to-database>')
    process.exit(1)
  }

  const absoluteDbPath = path.resolve(process.cwd(), dbPathArg)

  const { db } = createCrosschainDatabase(absoluteDbPath)
  const repository = new CrosschainRepository(db)

  console.log(`🔍 Scanning xc_asset_ops for missing symbols…`)

  const assetsToFix = await db
    .selectFrom('xc_asset_ops')
    .select(['journey_id', 'asset', 'role', 'sequence', 'symbol'])
    .where((eb) => eb.or([eb('symbol', '=', '???'), eb('symbol', 'is', null)]))
    .execute()

  console.log(`🔍 Found ${assetsToFix.length} unmapped assets`)

  let updatedCount = 0
  let unmappedCount = 0

  for (const row of assetsToFix) {
    const { journey_id, asset, role, sequence } = row

    const registryKey = assetToRegistryKey(asset)
    if (!registryKey) {
      unmappedCount++
      continue
    }

    const token = TOKEN_REGISTRY[registryKey]
    if (!token) {
      console.warn(`⚠️ No token registry entry for ${registryKey} (asset=${asset})`)
      unmappedCount++
      continue
    }

    await repository.updateAsset(
      journey_id,
      { asset, role, sequence },
      {
        symbol: token.symbol,
        decimals: token.decimals,
      },
    )

    console.log(`✅ Updated asset ${asset} on journey ${journey_id}: ${token.symbol} (${token.decimals})`)

    updatedCount++
  }

  console.log('\n✅ Done!')
  console.log(`Updated assets: ${updatedCount}`)
  console.log(`Unmapped assets: ${unmappedCount}`)

  await repository.close()
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
