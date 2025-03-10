import { Services } from '@/services/index.js'
import { LocalIngressConsumer } from '@/services/ingress/consumer/base.js'

import { Block, ChainInfo } from '../types.js'
import { BitcoinIngressConsumer } from './types.js'
import { BitcoinWatcher } from './watcher.js'

export class BitcoinLocalConsumer
  extends LocalIngressConsumer<BitcoinWatcher, Block, ChainInfo>
  implements BitcoinIngressConsumer
{
  constructor(ctx: Services) {
    super(ctx, new BitcoinWatcher(ctx))
  }
}
