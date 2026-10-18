import { NearLocalConsumer } from '@/services/networking/near/ingress/local.js'
import { initRuntime } from './ctx.js'

const { services } = initRuntime()

const consumer = new NearLocalConsumer(services)

await consumer.start()
consumer.finalizedBlocks('urn:ocn:near:397').subscribe((b) => {
  console.log('FINALIZED', b.number)
  console.log('transactions', b.transactions.length)
})
