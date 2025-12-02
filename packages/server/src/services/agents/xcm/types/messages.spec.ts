import { getSnowbridgeXcmBridge } from "@/testing/humanize.js"
import { mapXcmBridgeToXcmSent } from "./messages.js"

describe('XCM messages types', () => {
  describe('mapXcmBridgeToXcmSent', () => {
    it('should convert XcmBridge to XcmSent', () => {
      const msg = getSnowbridgeXcmBridge(1)
      const sent = mapXcmBridgeToXcmSent(msg)

      console.log(JSON.stringify(sent))
      expect(sent).toBeDefined()
      expect(sent.type).toBe('xcm.sent')
      expect(sent.partialHumanized).toBeDefined()
      expect(sent.partialHumanized?.beneficiary).toBeDefined()
      expect(sent.partialHumanized?.assets).toBeDefined()
    })
  })
})
