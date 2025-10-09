import { from } from 'rxjs'
import { moonbeamXcmBlock } from '@/testing/blocks.js'
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
})
