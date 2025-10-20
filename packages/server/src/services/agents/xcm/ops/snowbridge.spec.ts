import { from } from 'rxjs'
import { extractEvents } from '@/services/networking/substrate/index.js'
import { testBlocksFrom, testEvmBlocksFrom } from '@/testing/blocks.js'
import {
  extractSnowbridgeEvmInbound,
  extractSnowbridgeEvmOutbound,
  extractSnowbridgeSubstrateInbound,
  extractSnowbridgeSubstrateOutbound,
} from './snowbridge.js'

describe('snowbridge operator', () => {
  describe('extractSnowbridgeEvmInbound', () => {
    it('should extract snowbridge evm inbound', async () => {
      const block$ = from(testEvmBlocksFrom('ethereum/23618095.cbor'))
      const test$ = block$.pipe(
        extractSnowbridgeEvmInbound('urn:ocn:ethereum:1', '0x27ca963C279c93801941e1eB8799c23f407d68e7'),
      )
      const calls = vi.fn()

      await new Promise<void>((resolve) => {
        test$.subscribe({
          next: (log) => {
            calls()
          },
          complete: () => {
            expect(calls).toHaveBeenCalledTimes(1)
            resolve()
          },
        })
      })
    })
  })

  describe('extractSnowbridgeEvmOutbound', () => {
    it('should extract snowbridge evm outbound', async () => {
      const block$ = from(testEvmBlocksFrom('ethereum/23596716.cbor'))
      const test$ = block$.pipe(
        extractSnowbridgeEvmOutbound('urn:ocn:ethereum:1', '0x27ca963C279c93801941e1eB8799c23f407d68e7'),
      )
      const calls = vi.fn()

      await new Promise<void>((resolve) => {
        test$.subscribe({
          next: (log) => {
            calls()
          },
          complete: () => {
            expect(calls).toHaveBeenCalledTimes(1)
            resolve()
          },
        })
      })
    })
  })

  describe('extractSnowbridgeSubstrateInbound', () => {
    it('should extract snowbridge substrate inbound', async () => {
      const block$ = from(testBlocksFrom('bridgehub/6209062.cbor'))
      const test$ = block$.pipe(extractEvents(), extractSnowbridgeSubstrateInbound('urn:ocn:polkadot:1002'))
      const calls = vi.fn()

      await new Promise<void>((resolve) => {
        test$.subscribe({
          next: (msg) => {
            calls()
            expect(msg.chainId).toBe('urn:ocn:polkadot:1002')
            expect(msg.channelId).toBeDefined()
            expect(msg.messageId).toBeDefined()
            expect(msg.nonce).toBeDefined()
          },
          complete: () => {
            expect(calls).toHaveBeenCalledTimes(1)
            resolve()
          },
        })
      })
    })
  })

  describe('extractSnowbridgeSubstrateInbound', () => {
    it('should extract snowbridge substrate inbound', async () => {
      const block$ = from(testBlocksFrom('bridgehub/6226395.cbor'))
      const test$ = block$.pipe(extractEvents(), extractSnowbridgeSubstrateOutbound('urn:ocn:polkadot:1002'))
      const calls = vi.fn()

      await new Promise<void>((resolve) => {
        test$.subscribe({
          next: (msg) => {
            calls()
            console.log(msg)
            expect(msg.chainId).toBe('urn:ocn:polkadot:1002')
            expect(msg.messageId).toBeDefined()
            expect(msg.nonce).toBeDefined()
          },
          complete: () => {
            expect(calls).toHaveBeenCalledTimes(1)
            resolve()
          },
        })
      })
    })
  })
})
