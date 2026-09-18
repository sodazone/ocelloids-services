import { Observable } from 'rxjs'
import {
  Chain,
  GetBalanceParameters,
  GetBalanceReturnType,
  MulticallParameters,
  MulticallReturnType,
  ReadContractParameters,
  TransactionReceipt,
} from 'viem'

import { HexString } from '@/lib.js'
import { IngressConsumer } from '@/services/ingress/consumer/types.js'
import { NetworkURN } from '@/services/types.js'
import { Block, EvmLog, SerializableLog } from '../types.js'

export interface EvmIngressConsumer extends IngressConsumer {
  newBlocks(chainId: NetworkURN): Observable<Block>
  finalizedBlocks(chainId: NetworkURN): Observable<Block>
  getNetworkInfo(chainId: NetworkURN): Promise<Chain>
  getTransactionReceipt(chainId: string, txHash: HexString): Promise<TransactionReceipt>
  multicall(chainId: string, args: MulticallParameters): Promise<MulticallReturnType>
  readContract<T = any>(chainId: string, args: ReadContractParameters): Promise<T>
  getBalance(chainId: string, args: GetBalanceParameters): Promise<GetBalanceReturnType>
  getLogs(chainId: string, blockNumber: bigint | string): Promise<SerializableLog[]>
  getBlockTimestampMs(chainId: string, blockNumber: bigint | string): Promise<number>
  streamLogs(chainId: NetworkURN): Observable<EvmLog>
}
