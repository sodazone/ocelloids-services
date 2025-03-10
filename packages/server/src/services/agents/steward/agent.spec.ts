import { AbstractSublevel } from 'abstract-level'

import { SubstrateNetworkInfo } from '@/services/networking/substrate/ingress/types.js'
import { LevelDB } from '@/services/types.js'
import { createServices } from '@/testing/services.js'
import { QueryParams } from '../types.js'
import { DataSteward } from './agent.js'
import { AssetMetadata, StewardQueryArgs } from './types.js'
import { assetMetadataKey } from './util.js'

vi.mock('../../mappers.js', () => {
  return {
    mappers: {},
  }
})
const chainData = [
  {
    urn: 'urn:ocn:polkadot:0',
    genesisHash: '0x91b171bb158e2d3848fa23a9f1c25182fb8e20313b2c1eb49219da7a70ce90c3',
    existentialDeposit: '10000000000',
    chainTokens: ['DOT'],
    chainDecimals: [10],
    ss58Prefix: 42,
    runtimeChain: 'Polkadot',
  },
  {
    urn: 'urn:ocn:polkadot:1000',
    genesisHash: '0x68d56f15f85d3136970ec16946040bc1752654e906147f7e43e9d539d7c3de2f',
    existentialDeposit: '100000000',
    chainTokens: ['DOT'],
    chainDecimals: [10],
    ss58Prefix: 42,
    parachainId: '1000',
    runtimeChain: 'Polkadot Asset Hub',
  },
  {
    urn: 'urn:ocn:polkadot:1002',
    genesisHash: '0xdcf691b5a3fbe24adc99ddc959c0561b973e329b1aef4c4b22e7bb2ddecb4464',
    existentialDeposit: '1000000000',
    chainTokens: ['DOT'],
    chainDecimals: [10],
    ss58Prefix: 42,
    parachainId: '1002',
    runtimeChain: 'Polkadot BridgeHub',
  },
]

const assetData = [
  {
    chainId: 'urn:ocn:polkadot:1000',
    id: 1,
    xid: '0x01',
    externalIds: [],
    updated: Date.now(),
    raw: {},
  },
  {
    chainId: 'urn:ocn:polkadot:1000',
    id: 2,
    xid: '0x02',
    externalIds: [],
    updated: Date.now(),
    raw: {},
  },
  {
    chainId: 'urn:ocn:polkadot:1000',
    id: 3,
    xid: '0x03',
    externalIds: [],
    updated: Date.now(),
    raw: {},
  },
  {
    chainId: 'urn:ocn:polkadot:2000',
    id: 'native',
    xid: '0x',
    externalIds: [],
    updated: Date.now(),
    raw: {},
  },
] as AssetMetadata[]

describe('steward agent', () => {
  let steward: DataSteward
  let dbChains: LevelDB
  let dbAssets: AbstractSublevel<LevelDB, string | Buffer | Uint8Array, string, AssetMetadata>

  beforeAll(async () => {
    const services = createServices()
    const db = services.levelDB
    await db.open()
    steward = new DataSteward({ ...services, db })
    dbChains = db.sublevel<string, SubstrateNetworkInfo>('agent:steward:chains', {
      valueEncoding: 'json',
    })
    await dbChains.open()
    dbAssets = services.levelDB.sublevel<string, AssetMetadata>('agent:steward:assets', {
      valueEncoding: 'json',
    })
    await dbAssets.open()
    // Put mock chain data in db
    const dbBatch = dbChains.batch()
    for (const c of chainData) {
      await dbBatch.put(c.urn, c)
    }
    await dbBatch.write()
    // Put mock asset data in db
    const assetBatch = dbAssets.batch()
    for (const a of assetData) {
      await assetBatch.put(assetMetadataKey(a.chainId, a.id), a)
    }
    await assetBatch.write()
  })

  it('should return chain data for chains query', async () => {
    const results = await steward.query({
      args: {
        op: 'chains',
        criteria: {
          networks: ['urn:ocn:polkadot:0', 'urn:ocn:polkadot:1000', 'urn:ocn:polkadot:1002'],
        },
      },
    })

    expect(results.items).toBeDefined()
    expect(results.items.length).toBe(3)
  })

  it('should return chain data for chains list query', async () => {
    const results = await steward.query({
      args: {
        op: 'chains.list',
      },
    })

    expect(results.items).toBeDefined()
    expect(results.items.length).toBe(3)
    expect(results.pageInfo).toBeDefined()
    expect(results.pageInfo?.hasNextPage).toBe(false)
  })

  it('should return assets data for asset list query', async () => {
    const results = await steward.query({
      args: {
        op: 'assets.list',
        criteria: {
          network: 'urn:ocn:polkadot:1000',
        },
      },
    })

    expect(results.items).toBeDefined()
    expect(results.items.length).toBe(3)
    expect(results.pageInfo).toBeDefined()
    expect(results.pageInfo?.hasNextPage).toBe(false)
  })

  it('should handle paginated query', async () => {
    const results = await steward.query({
      args: {
        op: 'assets.list',
        criteria: {
          network: 'urn:ocn:polkadot:1000',
        },
      },
      pagination: {
        limit: 2,
      },
    })

    expect(results.items).toBeDefined()
    expect(results.items.length).toBe(2)
    expect(results.pageInfo).toBeDefined()
    expect(results.pageInfo?.hasNextPage).toBe(true)
    expect(results.pageInfo?.endCursor).toBeDefined()
  })

  it('should return asset data for asset query', async () => {
    const results = await steward.query({
      args: {
        op: 'assets',
        criteria: [
          {
            network: 'urn:ocn:polkadot:1000',
            assets: ['2'],
          },
          {
            network: 'urn:ocn:polkadot:2000',
            assets: ['native'],
          },
        ],
      },
    })

    expect(results.items).toBeDefined()
    expect(results.items.length).toBe(2)
  })

  it('should throw for unexpected query', async () => {
    await expect(
      steward.query({
        args: {
          op: 'foo',
        },
      } as unknown as QueryParams<StewardQueryArgs>),
    ).rejects.toThrow()
  })
})
