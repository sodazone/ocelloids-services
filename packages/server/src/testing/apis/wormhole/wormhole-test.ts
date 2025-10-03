import { mapOperationToJourney } from '@/services/agents/wormhole/mappers/index.js'
import { toDecimalAmount } from '@/services/agents/wormhole/types/decimals.js'
import { _test_whscanResponse } from '@/testing/apis/wormhole/data.js'

export type ExpectedAsset = {
  asset: string
  amount: string
  symbol?: string
  decimals?: number
  usd?: number
  fmtAmount?: number
}

export type TestCase = {
  name: string
  file: string
  expected: {
    type: string
    from: string
    to: string
    assets: ExpectedAsset[]
  }
}

export function runWormholeMapperTests(cases: TestCase[], label = 'wormhole mapper') {
  describe(label, () => {
    test.each(cases)('$name', ({ file, expected }) => {
      const j = mapOperationToJourney(_test_whscanResponse(file))

      expect(j.type).toBe(expected.type)
      expect(j.from).toBe(expected.from)
      expect(j.to).toBe(expected.to)
      expect(j.assets.length).toBe(expected.assets.length)

      expected.assets.forEach((asset, i) => {
        const actual = j.assets[i]
        expect(actual.asset).toBe(asset.asset)
        expect(actual.amount).toBe(asset.amount)
        if (asset.symbol !== undefined) {
          expect(actual.symbol).toBe(asset.symbol)
        }
        if (asset.decimals !== undefined) {
          expect(actual.decimals).toBe(asset.decimals)
          if (asset.fmtAmount !== undefined) {
            expect(toDecimalAmount(actual.amount, actual.decimals as number)).toBe(asset.fmtAmount)
          }
        }
        if (asset.usd !== undefined) {
          expect(actual.usd).toBeCloseTo(asset.usd, 6)
        }
      })
    })
  })
}
