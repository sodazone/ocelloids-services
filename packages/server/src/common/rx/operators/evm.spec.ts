import { filter, firstValueFrom, from } from 'rxjs'

import { moonbeamAbis, moonbeamBlocks } from '@/testing/blocks.js'
import { extractEvmLogs, extractEvmTransactions } from './evm.js'
import { extractEvents, extractTxWithEvents } from './extract.js'

describe('evm ops', () => {
  it('decode evm transaction with abi', async () => {
    const abis = moonbeamAbis()
    const tx = await firstValueFrom(
      from(moonbeamBlocks().slice(1)).pipe(
        extractTxWithEvents(),
        extractEvmTransactions([
          {
            abi: abis.swap,
            addresses: ['0x70085a09d30d6f8c4ecf6ee10120d1847383bb57'],
          },
          {
            abi: abis.erc20,
            addresses: [
              '0xacc15dc74880c9944775448304b263d191c6077f',
              '0x511ab53f793683763e5a8829738301368a2411e3',
              '0xb536c1f9a157b263b70a9a35705168acc0271742',
              '0xffffffff1fcacbd218edc0eba20fc2308c778080',
            ],
          },
        ]),
        filter((x) => x.decoded?.functionName === 'swapExactTokensForTokens'),
      ),
    )

    expect(tx).toBeDefined()
    expect(tx.decoded?.functionName).toBe('swapExactTokensForTokens')
    expect(tx.decoded?.args).toStrictEqual([
      176470588235294117647n,
      69557152793n,
      ['0xAcc15dC74880C9944775448304B263D191c6077F', '0xFfFFfFff1FcaCBd218EDc0EbA20Fc2308C778080'],
      '0x528e7aF33043Da06ca3DD407626a71DbBD3173D6',
      1731063508n,
    ])
    expect(tx.logs?.length).toBe(2)
    expect(tx.logs && tx.logs[0].eventName).toBe('Transfer')
  })

  it('decode evm logs with abi', async () => {
    const abis = moonbeamAbis()
    const tx = await firstValueFrom(
      from(moonbeamBlocks()).pipe(
        extractEvents(),
        extractEvmLogs([
          {
            abi: abis.prices,
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
