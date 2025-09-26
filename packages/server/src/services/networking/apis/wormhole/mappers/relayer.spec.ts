import { _test_whscanResponse } from '@/testing/apis/wormhole/data.js'
import { mapOperationToJourney } from './index.js'

describe('wormhole generic relayer mapper', () => {
  test('should decode moonwell transfer', () => {
    const j = mapOperationToJourney(_test_whscanResponse('moonbeam-base_well.json'))

    expect(j.type).toBe('transfer')
    expect(j.from).toBe('0xf97b954d39d8d9a2ee1b449802e8f19cb7230227')
    expect(j.to).toBe('0xf97b954d39d8d9a2ee1b449802e8f19cb7230227')
    expect(j.assets.length).toBe(1)
    expect(j.assets[0].asset).toBe('0xA88594D404727625A9437C3f886C7643872296AE')
    expect(j.assets[0].amount).toBe('10443992272616221569756')
  })
})
