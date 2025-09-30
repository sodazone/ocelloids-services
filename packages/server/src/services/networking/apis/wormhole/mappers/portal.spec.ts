import { _test_whscanResponse } from '@/testing/apis/wormhole/data.js'
import { mapOperationToJourney } from './index.js'

describe('wormhole portal mapper', () => {
  test('should decode WETH transfer', () => {
    const j = mapOperationToJourney(_test_whscanResponse('ethereum-moonbeam_weth.json'))

    expect(j.type).toBe('transfer')
    expect(j.from).toBe('0xb2f33c5718cc68a106f9d2a2ab3a11e70b5c70cc')
    expect(j.to).toBe('0xf6b9616c63fa48d07d82c93ce02b5d9111c51a3d')
    expect(j.assets.length).toBe(1)
    expect(j.assets[0].asset).toBe('urn:ocn:ethereum:1|0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2')
    // TODO: to be checked
    expect(j.assets[0].amount).toBe('49950000')
  })
})
