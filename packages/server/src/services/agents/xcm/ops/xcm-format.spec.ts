import { apiContext } from '@/testing/xcm.js'
import { fromXcmpFormat, messageHash, raw, versionedXcmCodec } from './xcm-format.js'

describe('xcm formats', () => {
  it('should decode xcmp concatenated fragments', () => {
    const moon4361335 =
      '0002100004000000001700004b3471bb156b050a13000000001700004b3471bb156b05010300286bee0d010004000101001e08eb75720cb63fbfcbe7237c6d9b7cf6b4953518da6b38731d5bc65b9ffa32021000040000000017206d278c7e297945030a130000000017206d278c7e29794503010300286bee0d010004000101000257fd81d0a71b094c2c8d3e6c93a9b01a31a43d38408bb2c4c2b49a4c58eb01'
    const buf = new Uint8Array(Buffer.from(moon4361335, 'hex'))

    const xcms = fromXcmpFormat(buf, apiContext)

    expect(xcms.length).toBe(2)
    expect(xcms[0].hash).toBe('0x256f9f3e5f89ced85d4253af0bd4fc6a47d069c7cd2c17723b87dda78a2e2b49')
  })

  it('should match message hash', () => {
    const dmpMessage =
      '04140104010000079ed68518090a130100000718740e9904000d01020400010300ba6d211834c09cf3da51f1b5ad1e5552ad79311b2ca67a693ad9f9547015177f90a29846374271580a4a8d5251d49eb269cadf6935'
    const buf = Buffer.from(dmpMessage, 'hex')
    expect(messageHash(buf)).toBe('0x3023923f007de86a3c62bf0224a36408ca4e79446174c87696aa6ef15d33b741')
  })

  it('should match partial XCM content hash', () => {
    const testVectors = [
      [
        '041000040000000b720e66a8a6210a130000000b39073354d310000e010204000100c91f08130100000b39073354d310000d010204000101000a385a4bb1bf8ff092734e41c9386cf3288f401fda7a2a1ecbf3bb7e968e1422',
        '03140104000100000b605df98da6210a13000100000b39073354d310000d010204000101000a385a4bb1bf8ff092734e41c9386cf3288f401fda7a2a1ecbf3bb7e968e14222c4d295af7a7071e5a013f8fece23671d19efe1b0af2f889c99bea0d0fdbbd0e5f',
      ],
      [
        '03100004000000000b9d443de351020a13000000000b4ea29ef12801000e010204000100511f0813000100000b4ea29ef12801000d0102040001030024cdaeb6069bc0ea562e9173de78d33846b8d996',
        '041401040100000b8bae87c951020a130100000b4ea29ef12801000d0102040001030024cdaeb6069bc0ea562e9173de78d33846b8d9962c2341a9c4573f9232320286ba6ff8ecc3f4bcc51ca9fcba14b254cb6bd770a6c8',
      ],
      [
        '031000040000000007ecca4184740a13000000000776e520423a000e010204000100c11f0813000100000776e520423a000d010204000101006268e9dc4432c3df9cc1171c3acf1b468fa6f4a28b0f7447b5e089eac41a077d',
        '0314010400010000075a9ef369740a13000100000776e520423a000d010204000101006268e9dc4432c3df9cc1171c3acf1b468fa6f4a28b0f7447b5e089eac41a077d2cc567519788fe323830211a495f1691be74c5e3cf2c3143dfb2f46bd4e56ba00a',
      ],
      [
        // HRMP concat
        '00041000040000001bb17ff1581ffd9a9262020a130000001bd8bf78ac8f7e4d493101000e010204010100c91f0813010100591f001bd9bf78ac8f7e4d493101000d01020400010100842745b99b8042d28a7c677d9469332bfc24aa5266c7ec57c43c7af125a0c16c',
        '000310010400010100591f001bb7bb1d071106fa9162020a1300010100591f001bd9bf78ac8f7e4d493101000d01020400010100842745b99b8042d28a7c677d9469332bfc24aa5266c7ec57c43c7af125a0c16c',
      ],
    ]
    for (const [origin, hop] of testVectors) {
      const bufOrigin = new Uint8Array(Buffer.from(origin, 'hex'))
      const xcm =
        bufOrigin[0] === 0
          ? raw.asXcmpVersionedXcms(bufOrigin, apiContext)[0]
          : raw.asVersionedXcm(bufOrigin, apiContext)
      const firstNested = xcm.instructions.value.find((op: any) => op.value && op.value.xcm !== undefined)
      const partialXcmToMatch = { type: xcm.instructions.type, value: firstNested.value.xcm }
      const partialXcm = Buffer.from(versionedXcmCodec(apiContext).enc(partialXcmToMatch)).toString('hex')
      expect(hop.includes(partialXcm.substring(8))).toBeTruthy()
    }
  })

  it('should return an empty array on blobs', () => {
    const buf = new Uint8Array(Buffer.from('0100', 'hex'))

    expect(fromXcmpFormat(buf, apiContext)).toStrictEqual([])
  })

  it('should fail on unknown format', () => {
    const buf = new Uint8Array(Buffer.from('BAD', 'hex'))

    expect(() => fromXcmpFormat(buf, apiContext)).toThrow(Error)
  })
})
