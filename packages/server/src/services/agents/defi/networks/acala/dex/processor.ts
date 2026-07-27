import { filter, firstValueFrom, map, Observable, Subject, Subscription, share, toArray } from 'rxjs'
import { AssetMetadata } from '@/services/agents/steward/types.js'
import { SubstrateIngressConsumer } from '@/services/networking/substrate/ingress/types.js'
import {
  Block,
  BlockEvent,
  extractEvents,
  SubstrateApiContext,
  storageEntriesAtLatest$,
} from '@/services/networking/substrate/index.js'
import { Logger } from '@/services/types.js'
import { smartTrigger } from '../../../rxjs/trigger.js'
import { DefiEventPayload, DefiSubscriptionPayload } from '../../../types.js'
import { CHAIN_ID } from '../common.js'
import { AcalaDexReservesValue, TokenId } from './types.js'
import { toMelbourne } from '@/services/agents/common/melbourne.js'
import { chunk } from '../../../common.js'

const ACALA_DEX_PROTOCOL = 'dex'
export const MAX_BATCH_SIZE = 50

export function createAcalaDexProcessor({
  logger,
  ingress,
  fetchAssetMetadata,
  subject,
}: {
  logger: Logger
  ingress: SubstrateIngressConsumer
  fetchAssetMetadata: (assets: string[]) => Promise<AssetMetadata[]>
  subject: Subject<DefiSubscriptionPayload>
}) {
  const subs: Subscription[] = []

  async function init() {
    const dexPoolEntries = await firstValueFrom(
      storageEntriesAtLatest$<[TokenId, TokenId], AcalaDexReservesValue>(
        ingress,
        CHAIN_ID,
        'Dex',
        'LiquidityPool',
      ).pipe(toArray()),
    )

    const tokenIdStrings = dexPoolEntries.flatMap(({ key }) => key).map(id => toMelbourne(id))
    const assetMetadatas = await Promise.all(
      chunk(tokenIdStrings, MAX_BATCH_SIZE).map((batch) => fetchAssetMetadata(batch)),
    ).then((results) => results.flat())

    for (const { key, value } of dexPoolEntries) {
      console.log('pool -----', key)
      console.log('-------', value)
    }
  }

  function createDefiEventPayload(event: BlockEvent): DefiEventPayload | null {
    return null
  }

  function watchEvents() {
    return (source$: Observable<BlockEvent>): Observable<DefiEventPayload> =>
      source$.pipe(
        filter((e) => e.module.toLowerCase() === ACALA_DEX_PROTOCOL),
        map((event) => createDefiEventPayload(event)),
        filter((payload): payload is DefiEventPayload => payload !== null),
      )
  }

  function onBlock(_apiCtx: SubstrateApiContext) {
    return async () => {
      // update dex reserves
    }
  }

  async function start(block$: Observable<Block>) {
    await init()
    const apiCtx = await firstValueFrom(ingress.getContext(CHAIN_ID))
    const events$ = block$.pipe(extractEvents(), watchEvents(), share())

    // Events
    subs.push(events$.subscribe((payload) => subject.next(payload)))

    // Liquidity
    subs.push(
      block$
        .pipe(
          smartTrigger<Block>({
            events$,
            maxStaleBlocks: 300,
          }),
        )
        .subscribe(onBlock(apiCtx)),
    )

    logger.info('[defi:acala-dex] Processor started.')
  }

  function stop() {
    subs.forEach((s) => s.unsubscribe())
    subs.length = 0

    logger.info('[defi:acala-dex] Processor stopped.')
  }

  return {
    start,
    stop,
  }
}
