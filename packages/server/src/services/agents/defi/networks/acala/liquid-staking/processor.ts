import { filter, firstValueFrom, map, Observable, Subject, Subscription, share, toArray } from 'rxjs'
import { ulid } from 'ulidx'
import { formatUnits } from 'viem'
import { asPublicKey } from '@/common/util.js'
import { toAssetId } from '@/services/agents/common/assets.js'
import { AssetMetadata } from '@/services/agents/steward/types.js'
import { AggregatedPriceData } from '@/services/agents/ticker/types.js'
import {
  Block,
  BlockEvent,
  extractEvents,
  SubstrateApiContext,
  storageEntriesAtLatest$,
} from '@/services/networking/substrate/index.js'
import { SubstrateIngressConsumer } from '@/services/networking/substrate/ingress/types.js'
import { HexString } from '@/services/subscriptions/types.js'
import { Logger } from '@/services/types.js'
import { smartTrigger } from '../../../rxjs/trigger.js'
import {
  AssetFlowActions,
  DefiEventData,
  DefiEventPayload,
  DefiLiquidityAsset,
  DefiLiquidityPayload,
  DefiSubscriptionPayload,
} from '../../../types.js'
import {
  CHAIN_ID,
  DOT_DECIMALS,
  DOT_SYMBOL,
  LDOT_DECIMALS,
  LDOT_SYMBOL,
  PRECISION_BIGINT,
  TARGET_PRECISION,
} from '../common.js'
import {
  HomaMintedEvent,
  HomaRedeemedByFastMatchEvent,
  HomaRedeemedByUnbondEvent,
  HomaStakingLedgerValue,
} from './types.js'

const HOMA_MODULE = 'homa'
const HOMA_PROTOCOL = 'acala.homa'
const HOMA_ADDRESS = '0x6d6f646c6163612f686f6d610000000000000000000000000000000000000000'

const LDOT_ASSET_ID = {
  type: 'Token',
  value: {
    type: 'LDOT',
  },
}

const DOT_ASSET_ID = {
  type: 'NativeAssetId',
  value: {
    type: 'Token',
    value: {
      type: 'DOT',
    },
  },
}

export function createHomaProcessor({
  logger,
  ingress,
  fetchPrices,
  subject,
}: {
  logger: Logger
  ingress: SubstrateIngressConsumer
  fetchAssetMetadata: (assets: string[]) => Promise<AssetMetadata[]>
  fetchPrices: (assets: string[]) => Promise<AggregatedPriceData[]>
  subject: Subject<DefiSubscriptionPayload>
}) {
  const subs: Subscription[] = []
  let dotPrice: number | null = null
  let ldotPrice: number | null = null

  function onBlock(apiCtx: SubstrateApiContext) {
    const tokenIssuanceCodec = apiCtx.storageCodec('Tokens', 'TotalIssuance')
    const totalVoidLiquidCodec = apiCtx.storageCodec('Homa', 'TotalVoidLiquid')

    const ldotIssuanceStorageKey = tokenIssuanceCodec.keys.enc(LDOT_ASSET_ID)
    const voidLiquidStorageKey = totalVoidLiquidCodec.keys.enc()

    return async () => {
      await updateDOTPrice()

      if (dotPrice === null) {
        logger.warn('[defi:acala] DOT price not available')
        return
      }

      const [stakingLedgerEntries, ldotIssuanceEntry, totalVoidLiquidEntry] = await Promise.all([
        firstValueFrom(
          storageEntriesAtLatest$<[number], HomaStakingLedgerValue>(
            ingress,
            CHAIN_ID,
            'Homa',
            'StakingLedgers',
          ).pipe(toArray()),
        ),
        firstValueFrom(ingress.getStorage(CHAIN_ID, ldotIssuanceStorageKey as HexString)),
        firstValueFrom(ingress.getStorage(CHAIN_ID, voidLiquidStorageKey as HexString)),
      ])

      const totalValueStaked = stakingLedgerEntries.reduce((total, { key, value: { bonded } }) => {
        return total + bonded
      }, 0n)

      const ldotIssuance = BigInt(tokenIssuanceCodec.value.dec(ldotIssuanceEntry))
      const totalVoidLiquid = BigInt(totalVoidLiquidCodec.value.dec(totalVoidLiquidEntry))
      const effectiveLiquidIssuance = ldotIssuance - totalVoidLiquid

      const exchangeRate =
        Number((totalValueStaked * PRECISION_BIGINT) / effectiveLiquidIssuance) / 10 ** TARGET_PRECISION

      ldotPrice = dotPrice * exchangeRate

      const stakedReserves = formatUnits(totalValueStaked, DOT_DECIMALS)
      const lstReserves = formatUnits(effectiveLiquidIssuance, DOT_DECIMALS)
      const suppliedUSD = Number(stakedReserves) * dotPrice

      const assets: DefiLiquidityAsset[] = [
        {
          assetId: toAssetId(CHAIN_ID, DOT_ASSET_ID),
          decimals: DOT_DECIMALS,
          symbol: DOT_SYMBOL,
          priceUSD: dotPrice,
          balances: {
            reserves: stakedReserves,
          },
          role: 'staked',
        },
        {
          assetId: toAssetId(CHAIN_ID, LDOT_ASSET_ID),
          decimals: DOT_DECIMALS,
          symbol: LDOT_SYMBOL,
          priceUSD: ldotPrice,
          balances: {
            reserves: lstReserves,
          },
          role: 'lst',
        },
      ]

      const payload: DefiLiquidityPayload = {
        type: 'liquidity',
        networkId: CHAIN_ID,
        category: 'liquid-staking',
        protocol: HOMA_PROTOCOL,
        marketId: HOMA_ADDRESS,
        suppliedUSD,
        assets,
        liquidStaking: {
          exchangeRate,
        },
      }

      subject.next(payload)
    }
  }

  function watchEvents() {
    return (source$: Observable<BlockEvent>): Observable<DefiEventPayload> =>
      source$.pipe(
        filter((e) => e.module.toLowerCase() === HOMA_MODULE),
        map((event) => createDefiEventPayload(event)),
        filter((payload): payload is DefiEventPayload => payload !== null),
      )
  }

  function createDefiEventPayload(event: BlockEvent): DefiEventPayload | null {
    const { blockNumber, blockHash, name, value, extrinsic } = event

    const basePayload = {
      id: ulid(),
      type: 'event' as const,
      networkId: CHAIN_ID,
      protocol: HOMA_PROTOCOL,
      marketId: HOMA_ADDRESS,
      blockHash,
      blockNumber: blockNumber.toString(),
      txHash: extrinsic?.hash ?? null,
    }

    switch (name.toLowerCase()) {
      case 'minted':
        return {
          ...basePayload,
          name: 'lst_mint',
          data: createMintData(value as HomaMintedEvent),
        }

      case 'redeemedbyfastmatch':
        return {
          ...basePayload,
          name: 'lst_redeem',
          data: createRedeemData(value as HomaRedeemedByFastMatchEvent, value.redeemed_staking_amount),
        }

      case 'redeemedbyunbond':
        return {
          ...basePayload,
          name: 'lst_redeem',
          data: createRedeemData(value as HomaRedeemedByUnbondEvent, value.unbonding_staking_amount),
        }

      default:
        return null
    }
  }

  function createMintData({
    minter,
    liquid_amount_received,
    staking_currency_amount,
  }: HomaMintedEvent): DefiEventData<'lst_mint'> {
    const suppliedAmount = formatUnits(staking_currency_amount, DOT_DECIMALS)
    const mintedAmount = formatUnits(liquid_amount_received, LDOT_DECIMALS)

    return {
      provider: asPublicKey(minter),
      supplied: {
        amount: suppliedAmount,
        assetId: toAssetId(CHAIN_ID, DOT_ASSET_ID),
        symbol: DOT_SYMBOL,
        amountUSD: dotPrice ? dotPrice * Number(suppliedAmount) : undefined,
      },
      minted: {
        amount: mintedAmount,
        assetId: toAssetId(CHAIN_ID, LDOT_ASSET_ID),
        symbol: LDOT_SYMBOL,
        amountUSD: ldotPrice ? ldotPrice * Number(mintedAmount) : undefined,
      },
    }
  }

  function createRedeemData(
    { redeemer }: HomaRedeemedByFastMatchEvent | HomaRedeemedByUnbondEvent,
    amount: bigint,
  ): DefiEventData<AssetFlowActions> {
    const redeemedAmount = formatUnits(amount, DOT_DECIMALS)

    return {
      provider: asPublicKey(redeemer),
      assets: [
        {
          amount: redeemedAmount,
          assetId: toAssetId(CHAIN_ID, DOT_ASSET_ID),
          symbol: DOT_SYMBOL,
          amountUSD: dotPrice ? dotPrice * Number(redeemedAmount) : undefined,
        },
      ],
    }
  }

  async function updateDOTPrice() {
    const prices = await fetchPrices([DOT_SYMBOL])
    if (prices.length > 0) {
      dotPrice = prices[0].medianPrice
    }
  }

  async function start(block$: Observable<Block>) {
    await updateDOTPrice()

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
    logger.info('[defi:acala-homa] Processor started.')
  }

  function stop() {
    subs.forEach((s) => s.unsubscribe())
    subs.length = 0
    logger.info('[defi:acala-homa] Processor stopped.')
  }

  return {
    start,
    stop,
  }
}
