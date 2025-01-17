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
        next: ({ hashData }) => {
          calls()
          expect(hashData).toBeDefined()
          expect(hashData[0].hash).toBeDefined()
          expect(hashData[0].data).toBeDefined()
          expect(hashData[1].hash).toBeDefined()
          expect(hashData[1].data).toBeDefined()
        },
        complete: () => {
          resolve()
          expect(calls).toHaveBeenCalledTimes(1)
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
        next: ({ hashData }) => {
          calls()
          expect(hashData).toBeDefined()
          expect(hashData[0].hash).toBeDefined()
          expect(hashData[0].data).toBeDefined()
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
        next: ({ hashData }) => {
          calls()
          expect(hashData).toBeDefined()
          expect(hashData[0].hash).toBeDefined()
          expect(hashData[0].data).toBeDefined()
        },
        complete: () => {
          resolve()
          expect(calls).toHaveBeenCalledTimes(1)
        },
      })
    })
  })
})
