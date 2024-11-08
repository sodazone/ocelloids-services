import { firstValueFrom, from } from 'rxjs'

import { moonbeamBlocks, stellaFeedsAbi } from '@/testing/blocks.js'
import { extractEvmLogs, extractEvmTransactions } from './evm.js'
import { extractEvents, extractTxWithEvents } from './extract.js'

describe('evm ops', () => {
  it('decode evm transaction with abi', async () => {
    const abi = stellaFeedsAbi()
    const tx = await firstValueFrom(
      from(moonbeamBlocks()).pipe(
        extractTxWithEvents(),
        extractEvmTransactions([
          {
            abi,
            addresses: ['0x7baadbcf1428fb217dec3e5e917c126a5258d4dc'],
          },
        ]),
      ),
    )
    expect(tx).toBeDefined()
    expect(tx.decoded?.functionName).toBe('setPricesWithBits')
    expect(tx.decoded?.args).toStrictEqual([
      14604785875833318142852275006850560180394230613076272n,
      1730373270n,
    ])
  })

  it('decode evm logs with abi', async () => {
    const abi = stellaFeedsAbi()
    const tx = await firstValueFrom(
      from(moonbeamBlocks()).pipe(
        extractEvents(),
        extractEvmLogs([
          {
            abi,
            addresses: ['0x7baadbcf1428fb217dec3e5e917c126a5258d4dc'],
          },
        ]),
      ),
    )
    expect(tx).toBeDefined()
    expect(tx.decoded?.eventName).toBe('PriceData')
    expect(tx.decoded?.args).toStrictEqual({
      cumulativeFastDelta: 0n,
      cumulativeRefDelta: 0n,
      fastPrice: 72515000000000000000000000000000000n,
      refPrice: 7220553472414n,
      token: '0xE57eBd2d67B462E9926e04a8e33f01cD0D64346D',
    })
  })
})
