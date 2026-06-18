import { from } from 'rxjs'
import { extractEvents } from '@/services/networking/substrate/index.js'
import { testBlocksFrom } from '@/testing/blocks.js'
import { networks } from '../../common/networks.js'
import { extractBasejumpLanding } from './destination.js'

describe('basejump destination operators', () => {
  describe('extractBasejumpLanding', () => {
    it('should extract Basejump landing queued', async () => {
      const blocks$ = from(testBlocksFrom('hydra/12636284.cbor'))
      const test$ = extractBasejumpLanding(
        networks.hydration,
        '0x70e9b12c3b19cb5f0e59984a5866278ab69df976',
      )(blocks$.pipe(extractEvents()))
      const calls = vi.fn()

      await new Promise<void>((resolve) => {
        test$.subscribe({
          next: (msg) => {
            calls()
            const id = msg.type === 'queued' ? msg.id : null
            expect(msg.chainId).toBe('urn:ocn:polkadot:2034')
            expect(msg.outcome).toBe('Success')
            expect(id).toBe(1)
            expect(msg.asset).toBeDefined()
            expect(msg.recipient).toBeDefined()
            expect(msg.amount).toBeDefined()
            expect(msg.blockHash).toBeDefined()
            expect(msg.blockNumber).toBeDefined()
            expect(msg.timestamp).toBeDefined()
          },
          complete: () => {
            expect(calls).toHaveBeenCalledTimes(1)
            resolve()
          },
        })
      })
    })

    it('should extract Basejump landing executed', async () => {
      const blocks$ = from(testBlocksFrom('hydra/12587459.cbor'))
      const test$ = extractBasejumpLanding(
        networks.hydration,
        '0x70e9b12c3b19cb5f0e59984a5866278ab69df976',
      )(blocks$.pipe(extractEvents()))
      const calls = vi.fn()

      await new Promise<void>((resolve) => {
        test$.subscribe({
          next: (msg) => {
            calls()
            const id = msg.type === 'queued' ? msg.id : null
            expect(msg.chainId).toBe('urn:ocn:polkadot:2034')
            expect(msg.outcome).toBe('Success')
            expect(id).toBeNull()
            expect(msg.asset).toBeDefined()
            expect(msg.recipient).toBeDefined()
            expect(msg.amount).toBeDefined()
            expect(msg.blockHash).toBeDefined()
            expect(msg.blockNumber).toBeDefined()
            expect(msg.timestamp).toBeDefined()
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
