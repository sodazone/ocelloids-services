import { Chain, GetBalanceParameters, MulticallParameters, ReadContractParameters } from 'viem'
import { HexString } from '@/lib.js'
import { LocalIngressConsumer } from '@/services/ingress/consumer/base.js'
import { Services } from '@/services/types.js'
import { BlockWithLogs } from '../types.js'
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

  async readContract<T = any>(chainId: string, args: ReadContractParameters) {
    return await this.watcher.readContract<T>(chainId, args)
  }

  async getBalance(chainId: string, args: GetBalanceParameters) {
    return await this.watcher.getBalance(chainId, args)
  }

  async getLogs(chainId: string, blockNumber: bigint | string) {
    const bn = typeof blockNumber === 'string' ? BigInt(blockNumber) : blockNumber
    return await this.watcher.getLogs(chainId, bn)
  }

  // watchEvents(chainId: NetworkURN, params: DecodeContractParams, eventNames?: string[]) {
  //   return this.watcher.watchEvents(chainId, params, eventNames)
  // }
}
