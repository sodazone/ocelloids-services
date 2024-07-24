import { jest } from '@jest/globals'

import { TypeRegistry } from '@polkadot/types'

import { registry } from '@/testing/xcm.js'
import { fromXcmpFormat } from './xcm-format.js'

describe('xcm formats', () => {
  it('should decode xcmp concatenated fragments', () => {
    const moon4361335 =
      '0002100004000000001700004b3471bb156b050a13000000001700004b3471bb156b05010300286bee0d010004000101001e08eb75720cb63fbfcbe7237c6d9b7cf6b4953518da6b38731d5bc65b9ffa32021000040000000017206d278c7e297945030a130000000017206d278c7e29794503010300286bee0d010004000101000257fd81d0a71b094c2c8d3e6c93a9b01a31a43d38408bb2c4c2b49a4c58eb01'
    const buf = new Uint8Array(Buffer.from(moon4361335, 'hex'))

    const xcms = fromXcmpFormat(buf, registry)

    expect(xcms.length).toBe(2)
    expect(xcms[0].hash.toHex()).toBe('0x256f9f3e5f89ced85d4253af0bd4fc6a47d069c7cd2c17723b87dda78a2e2b49')
  })

  it('should return an empty array on blobs', () => {
    const buf = new Uint8Array(Buffer.from('0100', 'hex'))

    expect(fromXcmpFormat(buf, registry)).toStrictEqual([])
  })

  it('should fail on unknown format', () => {
    const buf = new Uint8Array(Buffer.from('BAD', 'hex'))

    expect(() => fromXcmpFormat(buf, registry)).toThrow(Error)
  })

  it('should fail on registry with no XCM types', () => {
    const errorLogSpy = jest.spyOn(console, 'error').mockImplementationOnce(() => {
      // noop
    })
    const defaultRegistry = new TypeRegistry()
    const buf = new Uint8Array(
      Buffer.from(
        '000310010400010300a10f043205011f00034cb0a37d0a1300010300a10f043205011f00034cb0a37d000d010204000101008e7f870a8cac3fa165c8531a304fcc59c7e29aec176fb03f630ceeea397b1368',
        'hex',
      ),
    )

    const xcms = fromXcmpFormat(buf, defaultRegistry)
    expect(errorLogSpy).toHaveBeenCalled()
    expect(xcms.length).toBe(0)
  })
})
