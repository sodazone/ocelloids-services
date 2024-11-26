import { AbstractSublevel } from 'abstract-level'
import { of } from 'rxjs'

import { IngressConsumer } from '@/services/ingress/index.js'
import { ApiContext } from '@/services/networking/index.js'
import { LevelDB } from '@/services/types.js'
import { createServices } from '@/testing/services.js'
import { AssetMetadata } from '../../types.js'
import { LocationQueryHandler } from './handler.js'

vi.mock('../../mappers.js', () => {
  return {
    mappers: {
      'urn:ocn:polkadot:2030': (_apiContext: ApiContext) => [
        {
          mapAssetId: (_data: Uint8Array) => {
            return [
              {
                type: 'VToken2',
                value: 8,
              },
            ]
          },
        },
      ],
    },
  }
})

describe('steward location query handler', () => {
  let locationHandler: LocationQueryHandler
  let dbAssets: AbstractSublevel<LevelDB, string | Buffer | Uint8Array, string, AssetMetadata>
  let ingress: IngressConsumer

  beforeAll(() => {
    const services = createServices()
    dbAssets = services.levelDB.sublevel<string, AssetMetadata>('agent:steward:assets', {
      valueEncoding: 'json',
    })
    ingress = services.ingress
    locationHandler = new LocationQueryHandler(dbAssets, ingress)
  })

  it('should retrieve asset with simple string asset ID', async () => {
    const dbGetManySpy = vi.spyOn(dbAssets, 'getMany')

    await new Promise<void>((resolve) => {
      locationHandler
        .queryAssetByLocation([
          {
            xcmLocationAnchor: 'urn:ocn:polkadot:2034',
            locations: [
              `{"parents":1,"interior":{"type":"X2","value":[
          {
            "type": "Parachain",
            "value": 2004
          },
          {
            "type": "PalletInstance",
            "value": 10
          }
        ]}}`,
            ],
          },
        ])
        .then((result) => {
          expect(result.items).toBeDefined()
          expect(dbGetManySpy).toHaveBeenCalledWith(['urn:ocn:polkadot:2004:native'], {})
          resolve()
        })
    })
  })

  it('should retrieve asset with complex structure as asset ID', async () => {
    const dbGetManySpy = vi.spyOn(dbAssets, 'getMany')
    vi.spyOn(ingress, 'getContext').mockImplementationOnce(() => of({} as unknown as ApiContext))

    await new Promise<void>((resolve) => {
      locationHandler
        .queryAssetByLocation([
          {
            xcmLocationAnchor: 'urn:ocn:polkadot:1000',
            locations: [
              `{"parents":1,"interior":{"type":"X2","value":[{"type":"Parachain","value":2030},{"type":"GeneralKey","value":{"length":2,"data":"0x0001000000000000000000000000000000000000000000000000000000000000"}}]}}`,
            ],
          },
        ])
        .then((result) => {
          expect(result.items).toBeDefined()
          expect(dbGetManySpy).toHaveBeenCalledWith(['urn:ocn:polkadot:2030:vtoken2:8'], {})
          resolve()
        })
    })
  })
})
