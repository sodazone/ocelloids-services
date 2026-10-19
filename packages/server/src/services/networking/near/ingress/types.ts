import { Observable } from 'rxjs'
import { IngressConsumer } from '@/services/ingress/index.js'
import { NetworkURN } from '@/services/types.js'
import { NearBlock, NearNetworkInfo, NearTxStatus } from '../types.js'

export interface NearIngressConsumer extends IngressConsumer {
  newBlocks(chainId: NetworkURN): Observable<NearBlock>
  finalizedBlocks(chainId: NetworkURN): Observable<NearBlock>
  getTransactionStatus(chainId: string, txHash: string, senderAccountId: string): Promise<NearTxStatus>
  getNetworkInfo(chainId: NetworkURN): Promise<NearNetworkInfo>
}
