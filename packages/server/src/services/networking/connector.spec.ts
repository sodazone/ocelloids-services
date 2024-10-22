import { vi } from 'vitest'

vi.mock('./client/archive.js', () => {
  return {
    ArchiveClient: vi.fn().mockReturnValue({
      connect: vi.fn().mockResolvedValue(true),
      disconnect: vi.fn(),
    }),
  }
})

import { mockConfigRelayLast, mockConfigWS } from '@/testing/configs.js'
import { _log } from '@/testing/services.js'
import Connector from './connector.js'

describe('connector', () => {
  describe('connect', () => {
    it('should return all network apis with RPC-only config', () => {
      const connector = new Connector(_log, mockConfigWS)
      const apis = connector.connect()

      expect(Object.keys(apis).length).toBe(3)
      expect(apis['urn:ocn:local:0']).toBeDefined()
      expect(apis['urn:ocn:local:1000']).toBeDefined()
      expect(apis['urn:ocn:local:2006']).toBeDefined()
    })

    it('should return all network apis with relay network as the last item in the config', () => {
      const connector = new Connector(_log, mockConfigRelayLast)
      const apis = connector.connect()

      expect(Object.keys(apis).length).toBe(3)
      expect(apis['urn:ocn:local:0']).toBeDefined()
      expect(apis['urn:ocn:local:1000']).toBeDefined()
      expect(apis['urn:ocn:local:2006']).toBeDefined()
    })

    it('should return apis if already registered', () => {
      const connector = new Connector(_log, mockConfigWS)
      const apis = connector.connect()

      expect(Object.keys(apis).length).toBe(3)

      const apisToo = connector.connect()
      expect(apisToo).toEqual(apis)
    })
  })

  describe('disconnect', () => {
    it('should call disconnect on apis', () => {
      const connector = new Connector(_log, mockConfigWS)
      const apis = connector.connect()

      expect(Object.keys(apis).length).toBe(3)

      const disconnectSpy = vi.spyOn(Object.values(apis)[0], 'disconnect')
      connector.disconnect()
      expect(disconnectSpy).toHaveBeenCalledTimes(3)
    })
  })
})
