import { Chain } from 'viem'

import { LocalIngressConsumer } from '@/services/ingress/consumer/base.js'
import { Services } from '@/services/types.js'

import { BlockWithLogs } from '../types.js'
import { EvmIngressConsumer } from './types.js'
import { EvmWatcher } from './watcher.js'
import { HexString } from '@/lib.js'

export class EvmLocalConsumer
  extends LocalIngressConsumer<EvmWatcher, BlockWithLogs, Chain>
  implements EvmIngressConsumer
{
  constructor(ctx: Services) {
    super(ctx, new EvmWatcher(ctx))
  }

  async getTransactionReceipt(chainId: string, txHash: HexString) {
    return await this.watcher.getTransactionReceipt(chainId, txHash)
  }
}
