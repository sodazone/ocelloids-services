import { firstValueFrom, from } from 'rxjs'

import { moonbeamBlocks, stellaFeedsAbi } from '@/testing/blocks.js'
import { extractEvmTransactions } from './evm.js'
import { extractTxWithEvents } from './extract.js'

describe('evm ops', () => {
  it('decode evm transaction with abi', async () => {
    const abi = stellaFeedsAbi()
    const tx = await firstValueFrom(
      from(moonbeamBlocks()).pipe(
        extractTxWithEvents(),
        extractEvmTransactions({
          abi,
          addresses: ['0x7baadbcf1428fb217dec3e5e917c126a5258d4dc'],
        }),
      ),
    )
    expect(tx).toBeDefined()
    expect(tx.decoded?.functionName).toBe('setPricesWithBits')
  })
})
