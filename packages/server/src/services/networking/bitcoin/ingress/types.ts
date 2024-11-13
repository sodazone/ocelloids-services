import { Observable } from 'rxjs'

import { NetworkURN } from '@/lib.js'
import { IngressConsumer } from '@/services/ingress/consumer/types.js'
import { Block, ChainInfo } from '../types.js'

export interface BitcoinIngressConsumer extends IngressConsumer {
  finalizedBlocks(chainId: NetworkURN): Observable<Block>
  getChainInfo(chainId: NetworkURN): Promise<ChainInfo>
}
