import { LocalIngressConsumer } from '@/services/ingress/consumer/base.js'
import { Services } from '@/services/types.js'
import { NearBlock, NearNetworkInfo, NearTxStatus } from '../types.js'
import { NearIngressConsumer } from './types.js'
import { NearWatcher } from './watcher.js'

export class NearLocalConsumer
  extends LocalIngressConsumer<NearWatcher, NearBlock, NearNetworkInfo>
  implements NearIngressConsumer
{
  constructor(ctx: Services) {
    super(ctx, new NearWatcher(ctx))
  }

  async getTransactionStatus(
    chainId: string,
    txHash: string,
    senderAccountId: string,
  ): Promise<NearTxStatus> {
    return await this.watcher.getTransactionStatus(chainId, txHash, senderAccountId)
  }
}
