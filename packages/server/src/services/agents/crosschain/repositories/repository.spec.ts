import { createCrosschainDatabase } from './db.js'
import { CrosschainRepository } from './repository.js'
import { NewAssetOperation, NewJourney } from './types.js'

describe('CrosschainRepository', () => {
  let repo: CrosschainRepository

  beforeAll(async () => {
    const { db, migrator } = createCrosschainDatabase(':memory:')
    repo = new CrosschainRepository(db)
    await migrator.migrateToLatest()
  })

  afterAll(async () => {
    await repo.close()
  })

  function makeJourney(overrides: Partial<NewJourney> = {}): NewJourney {
    return {
      correlation_id: `corr-${Math.random()}`,
      status: 'pending',
      type: 'transfer',
      protocol: 'xcm',
      origin: 'chainA',
      destination: 'chainB',
      from: '0xfrom',
      to: '0xto',
      from_formatted: undefined,
      to_formatted: undefined,
      sent_at: Date.now(),
      recv_at: undefined,
      created_at: Date.now(),
      stops: '',
      instructions: '',
      transact_calls: '',
      origin_tx_primary: undefined,
      origin_tx_secondary: undefined,
      ...overrides,
    }
  }

  function makeAsset(journeyId: number, overrides: Partial<NewAssetOperation> = {}): NewAssetOperation {
    return {
      journey_id: journeyId,
      asset: 'DOT',
      symbol: 'DOT',
      amount: '100',
      decimals: 10,
      usd: 500,
      role: 'transfer',
      sequence: 0,
      ...overrides,
    }
  }

  it('inserts a journey with assets and retrieves it', async () => {
    const journey = makeJourney()
    const [inserted] = await repo.addJourneys([{ journey, assets: [makeAsset(0)] }])

    const fetched = await repo.getJourneyById(inserted)
    expect(fetched).toBeDefined()
    expect(fetched!.id).toBe(inserted)
    expect(fetched!.assets).toHaveLength(1)
    expect(fetched!.assets[0].asset).toBe('DOT')
    expect(fetched!.totalUsd).toBe(500)
  })

  it('connects two journeys into one trip', async () => {
    const [j1] = await repo.addJourneys([{ journey: makeJourney(), assets: [] }])
    const [j2] = await repo.addJourneys([{ journey: makeJourney(), assets: [] }])

    const trip_id = await repo.connectJourneys(j1, j2, { note: 'linked' })

    const tripJourneys = await repo.getTripJourneys(trip_id)
    expect(tripJourneys).toHaveLength(2)

    const upstream = tripJourneys.find((j) => j.id === j1)!
    const downstream = tripJourneys.find((j) => j.id === j2)!

    expect(upstream.out_connection_fk).toBe(downstream.id)
    expect(downstream.in_connection_fk).toBe(upstream.id)
    expect(upstream.out_connection_data).toStrictEqual({ note: 'linked' })
    expect(downstream.in_connection_data).toStrictEqual({ note: 'linked' })
    expect(upstream.trip_id).toBe(downstream.trip_id)
  })

  it('getTripJourneys returns journeys in ascending id order', async () => {
    const [j1] = await repo.addJourneys([{ journey: makeJourney({ origin: 'chainX' }), assets: [] }])
    const [j2] = await repo.addJourneys([{ journey: makeJourney({ origin: 'chainY' }), assets: [] }])

    const trip_id = await repo.connectJourneys(j1, j2)

    const trip = await repo.getTripJourneys(trip_id)
    expect(trip.map((j) => j.origin)).toEqual(['chainX', 'chainY'])
  })
})
