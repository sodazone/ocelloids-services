import { normalizeAssetId } from './melbourne.js'

describe('melbourne', () => {
  it('should bypass a string asset id', () => {
    expect(normalizeAssetId('hello')).toBe('hello')
  })

  it('should normalize a numeric asset id', () => {
    expect(normalizeAssetId(100)).toBe('100')
  })

  it('should normalize object asset ids', () => {
    const ids = [
      [
        {
          type: 't1',
          value: {
            type: 't2',
            value: 'hello',
          },
        },
        't1:t2:hello',
      ],
      [
        {
          type: 't1',
        },
        't1',
      ],
      [
        {
          type: 't1',
          value: 'hello',
        },
        't1:hello',
      ],
      [
        {
          type: 't1',
          value: {
            type: 't2',
            value: {
              type: 't3',
              value: 'hello',
            },
          },
        },
        't1:t2:t3:hello',
      ],
    ]

    for (const id of ids) {
      expect(normalizeAssetId(id[0])).toBe(id[1])
    }
  })
})
