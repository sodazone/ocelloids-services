import { bigintToPaddedHex } from './util.js'

describe('Precompile address', () => {
  it('should convert to precompile address', () => {
    expect(bigintToPaddedHex(112679793397406599376365943185137098326n)).toBe(
      '0xFFFFFFFF54c556bd1d0f64ec6c78f1b477525e56',
    )
  })
})
