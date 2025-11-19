import { decodeAssetTeleportRequest } from './decode.js'

describe('hyperbridge payload decoding', () => {
  describe('decodeAssetTeleportRequest', () => {
    it('should decode asset teleport', () => {
      const payload =
        '0x000000000000000000000000000000000000000000000001ca2f01cd67ee7600009bd00430e53a5999c7c603cfc04cbdaf68bdbc180f300e4a2067937f57a0534f000000000000000000000000000000000000000000000000000000000000000056477e294921d889dfbdcaf415dc931ffd4953c4955479d472becd96dc6b512b00000000000000000000000079fab311c8c6cf0a39d9d8296cf2a26c5ca84de6'
      const decoded = decodeAssetTeleportRequest(payload)

      expect(decoded).toBeDefined()
    })
  })
})
