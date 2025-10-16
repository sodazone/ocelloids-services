import { from } from 'rxjs'
import { moonbeamXcmBlock, testBlocksFrom } from '@/testing/blocks.js'
import { extractEvents } from './extract.js'

describe('extract operators', () => {
  it('should extract event with EVM tx hash', async () => {
    let matches = 0
    await new Promise<void>((resolve) => {
      from(moonbeamXcmBlock())
        .pipe(extractEvents())
        .subscribe({
          next: (event) => {
            expect(event).toBeDefined()
            if (
              (event.module === 'XcmpQueue' && event.name === 'XcmpMessageSent') ||
              (event.module === 'PolkadotXcm' && event.name === 'Sent')
            ) {
              expect(event.extrinsic).toBeDefined()
              expect(event.extrinsic?.evmTxHash).toBeDefined()
              expect(event.extrinsic?.evmTxHash).toBe(
                '0xb25028435393a0f2da435558e8655525bd02bb216b358bcc8057d8027e3336b4',
              )
              matches++
            }
          },
          complete: () => resolve(),
        })
    })
    expect(matches).toBe(2)
  })

  it('should extract events in Frontier', async () => {
    const test$ = from(testBlocksFrom('moonbeam/12960125.cbor')).pipe(extractEvents())
    const errorCb = vi.fn()
    await new Promise<void>((resolve) => {
      test$.subscribe({
        error: (err) => {
          console.error(err)
          errorCb()
        },
        complete: () => {
          expect(errorCb).toHaveBeenCalledTimes(0)
          resolve()
        },
      })
    })
  })
})
