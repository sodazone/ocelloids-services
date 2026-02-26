import { Observable } from 'rxjs'
import {
  Chain,
  MulticallParameters,
  MulticallReturnType,
  ReadContractParameters,
  TransactionReceipt,
} from 'viem'

import { HexString, NetworkURN } from '@/lib.js'
import { IngressConsumer } from '@/services/ingress/consumer/types.js'
import { BlockWithLogs, DecodeContractParams, DecodedLog } from '../types.js'

export interface EvmIngressConsumer extends IngressConsumer {
  newBlocks(chainId: NetworkURN): Observable<BlockWithLogs>
  finalizedBlocks(chainId: NetworkURN): Observable<BlockWithLogs>
  getNetworkInfo(chainId: NetworkURN): Promise<Chain>
  getTransactionReceipt(chainId: string, txHash: HexString): Promise<TransactionReceipt>
  multicall(chainId: string, args: MulticallParameters): Promise<MulticallReturnType>
  readContract<T = any>(chainId: string, args: ReadContractParameters): Promise<T>
  watchEvents(
    chainId: NetworkURN,
    params: DecodeContractParams,
    eventNames?: string[],
  ): Observable<DecodedLog>
}
