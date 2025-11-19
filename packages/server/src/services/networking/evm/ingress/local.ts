import { Chain, MulticallParameters } from 'viem'
import { HexString } from '@/lib.js'
import { LocalIngressConsumer } from '@/services/ingress/consumer/base.js'
import { NetworkURN, Services } from '@/services/types.js'
import { BlockWithLogs, DecodeContractParams } from '../types.js'
import { EvmIngressConsumer } from './types.js'
import { EvmWatcher } from './watcher.js'

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

  async multicall(chainId: string, args: MulticallParameters) {
    return await this.watcher.multiCall(chainId, args)
  }

  watchEvents(chainId: NetworkURN, params: DecodeContractParams, eventNames?: string[]) {
    return this.watcher.watchEvents(chainId, params, eventNames)
  }
}
