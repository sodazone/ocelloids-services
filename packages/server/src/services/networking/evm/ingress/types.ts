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

import { HexString, NetworkURN } from '@/lib.js'
import { IngressConsumer } from '@/services/ingress/consumer/types.js'
import { BlockWithLogs } from '../types.js'

export interface EvmIngressConsumer extends IngressConsumer {
  newBlocks(chainId: NetworkURN): Observable<BlockWithLogs>
  finalizedBlocks(chainId: NetworkURN): Observable<BlockWithLogs>
  getNetworkInfo(chainId: NetworkURN): Promise<Chain>
  getTransactionReceipt(chainId: string, txHash: HexString): Promise<TransactionReceipt>
  multicall(chainId: string, args: MulticallParameters): Promise<MulticallReturnType>
  readContract<T = any>(chainId: string, args: ReadContractParameters): Promise<T>
  getBalance(chainId: string, args: GetBalanceParameters): Promise<GetBalanceReturnType>
}
