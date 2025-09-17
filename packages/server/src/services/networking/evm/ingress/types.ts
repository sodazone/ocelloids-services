import { Observable } from 'rxjs'
import { Chain } from 'viem'

import { NetworkURN } from '@/lib.js'
import { IngressConsumer } from '@/services/ingress/consumer/types.js'
import { BlockWithLogs } from '../types.js'

export interface EvmIngressConsumer extends IngressConsumer {
  newBlocks(chainId: NetworkURN): Observable<BlockWithLogs>
  finalizedBlocks(chainId: NetworkURN): Observable<BlockWithLogs>
  getNetworkInfo(chainId: NetworkURN): Promise<Chain>
}
