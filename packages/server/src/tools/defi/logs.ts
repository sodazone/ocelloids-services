import { erc20Abi, Hex } from 'viem'
import { EvmLocalConsumer } from '@/services/networking/evm/ingress/local.js'
import { enrichLogWithTimestamp, filterAndDecodeLogs } from '@/services/networking/evm/rx/extract.js'
import { initRuntime } from './ctx.js'

const TOKENS: Hex[] = ['0xd0601CE157Db5bdC3162BbaC2a2C8aF5320D9EEC'].map((t) => t.toLowerCase() as Hex)
const CHAIN_ID = 'urn:ocn:ethereum:4663'

const { services } = initRuntime()

const consumer = new EvmLocalConsumer(services)

await consumer.start()

const sub = consumer
  .streamLogs(CHAIN_ID)
  .pipe(
    filterAndDecodeLogs({ abi: erc20Abi, addresses: TOKENS }, ['Transfer']),
    enrichLogWithTimestamp(CHAIN_ID, (blockNumber: bigint | string) =>
      consumer.getBlockTimestampMs(CHAIN_ID, blockNumber),
    ),
  )
  .subscribe({
    next: (log) => {
      const tf = {
        address: log.address,
        timestamp: log.timestamp,
        ...(log.args ?? {}),
      }
      console.log('TRANSFER', log.blockNumber, tf)
    },
    error: (err) => console.error('Uncaught stream error:', err),
  })

setTimeout(async () => {
  sub.unsubscribe()
  await consumer.stop()
}, 60_000)
