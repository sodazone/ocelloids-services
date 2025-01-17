import { testBlocksFrom } from '@/testing/blocks.js'
import { apiContext } from '@/testing/xcm.js'
import { from } from 'rxjs'
import { extractXcmMessageData } from './tracking.js'

describe('extractXcmMessageData', () => {
  it('should extract xcm messages from dmp and hrmp', async () => {
    const blocks = from(testBlocksFrom('hydra/6783591.cbor'))
    const calls = vi.fn()
    const test$ = extractXcmMessageData(apiContext)(blocks.pipe())

    new Promise<void>((resolve) => {
      test$.subscribe({
        next: (xcm) => {
          calls()
          expect(xcm).toBeDefined()
          expect(xcm.hash).toBeDefined()
          expect(xcm.data).toBeDefined()
        },
        complete: () => {
          resolve()
          expect(calls).toHaveBeenCalledTimes(2)
        },
      })
    })
  })

  it('should extract xcm messages from hrmp', async () => {
    const blocks = from(testBlocksFrom('astar/7898378.cbor'))
    const calls = vi.fn()
    const test$ = extractXcmMessageData(apiContext)(blocks.pipe())

    new Promise<void>((resolve) => {
      test$.subscribe({
        next: (xcm) => {
          console.log(xcm)
          calls()
          expect(xcm).toBeDefined()
          expect(xcm.hash).toBeDefined()
          expect(xcm.data).toBeDefined()
        },
        complete: () => {
          resolve()
          expect(calls).toHaveBeenCalledTimes(1)
        },
      })
    })
  })

  it('should extract xcm messages from hrmp bifrost', async () => {
    const blocks = from(testBlocksFrom('bifrost/6352399.cbor'))
    const calls = vi.fn()
    const test$ = extractXcmMessageData(apiContext)(blocks.pipe())

    new Promise<void>((resolve) => {
      test$.subscribe({
        next: (xcm) => {
          console.log(xcm)
          calls()
          expect(xcm).toBeDefined()
          expect(xcm.hash).toBeDefined()
          expect(xcm.data).toBeDefined()
        },
        complete: () => {
          resolve()
          expect(calls).toHaveBeenCalledTimes(1)
        },
      })
    })
  })
})
