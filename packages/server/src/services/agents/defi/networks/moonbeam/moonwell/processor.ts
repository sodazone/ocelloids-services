import { Observable, Subject, Subscription, share } from 'rxjs'
import { ulid } from 'ulidx'
import { Abi, formatUnits } from 'viem'
import { NetworkURN } from '@/lib.js'
import { EvmIngressConsumer } from '@/services/networking/evm/ingress/types.js'
import { filterLogs } from '@/services/networking/evm/rx/extract.js'
import { BlockWithLogs } from '@/services/networking/evm/types.js'
import { Logger } from '@/services/types.js'
import { createMoonwellDataFetcher, mTokenAbi } from '../../../protocols/moonwell/fetcher.js'
import { Market } from '../../../protocols/moonwell/types.js'
import { smartTrigger } from '../../../rxjs/trigger.js'
import {
  DefiEventAction,
  DefiEventAsset,
  DefiEventPayload,
  DefiPricePayload,
  DefiSubscriptionPayload,
} from '../../../types.js'
import { defs } from './definitions.js'

export function createMoonwellProcessor({
  logger,
  chainId,
  ingress,
  subject,
}: {
  logger: Logger
  chainId: NetworkURN
  ingress: EvmIngressConsumer
  subject: Subject<DefiSubscriptionPayload>
}) {
  const subs: Subscription[] = []
  const fetcher = createMoonwellDataFetcher(chainId, ingress)

  const activeMarketEntries = Object.values(defs.markets).filter((m) => !('deprecated' in m))
  const marketAddresses = activeMarketEntries.map((m) => defs.tokens[m.marketToken].address)
  const prices: Map<string, number> = new Map()
  /**
   * Refreshes all market data and pushes to the subject
   */
  async function updateAllMarkets(blockNumber?: bigint) {
    try {
      const markets: Market[] = activeMarketEntries.map((m) => ({
        mToken: defs.tokens[m.marketToken],
        underlying: defs.tokens[m.underlyingToken],
      }))

      for (const market of markets) {
        const marketData = await fetcher.getMarketData(
          market,
          defs.contracts.oracle,
          defs.contracts.comptroller,
          blockNumber,
        )

        for (const a of marketData.assets) {
          prices.set(a.assetId, a.priceUSD)
        }

        subject.next(marketData)
      }
    } catch (err) {
      console.error(`[moonwell] Failed update at block ${blockNumber}:`, err)
    }
  }

  async function start(blockWithLogs$: Observable<BlockWithLogs>, _lastStoredPrices: DefiPricePayload[]) {
    await updateAllMarkets()

    const events$ = blockWithLogs$.pipe(
      filterLogs({ abi: mTokenAbi as Abi, addresses: marketAddresses }, [
        'Mint',
        'Redeem',
        'Borrow',
        'RepayBorrow',
        'LiquidateBorrow',
      ]),
      share(),
    )

    // Event
    subs.push(
      events$.subscribe({
        next: (log) => {
          try {
            const eventName = log.eventName
            const args = log.args as Record<string, any>

            const targetMarketAddress = log.address.toLowerCase()
            const marketMeta = Object.values(defs.markets).find(
              (m) => defs.tokens[m.marketToken].address.toLowerCase() === targetMarketAddress,
            )
            if (!marketMeta) {
              return
            }

            const underlyingToken = defs.tokens[marketMeta.underlyingToken]
            const underlyingPrice = prices.get(underlyingToken.address)

            if (eventName === 'LiquidateBorrow') {
              const collateralAddress = args.mTokenCollateral.toLowerCase()
              const collateralMeta = Object.values(defs.markets).find(
                (m) => defs.tokens[m.marketToken].address.toLowerCase() === collateralAddress,
              )
              const collateralToken = collateralMeta ? defs.tokens[collateralMeta.underlyingToken] : undefined
              if (!collateralToken || !underlyingToken) {
                return
              }

              const amountDebt = formatUnits(args.repayAmount, underlyingToken.decimals)
              const amountCollateral = formatUnits(args.seizeTokens, collateralToken.decimals)
              const priceCollateral = prices.get(collateralToken.address)

              subject.next({
                type: 'event',
                id: ulid(),
                marketId: targetMarketAddress,
                protocol: 'moonwell',
                networkId: chainId,
                blockNumber: log.blockNumber,
                blockHash: log.blockHash,
                txHash: log.transactionHash,
                name: 'liquidate',
                data: {
                  origin: args.liquidator.toLowerCase(),
                  counterparty: args.borrower.toLowerCase(),
                  debt: {
                    assetId: underlyingToken.address,
                    symbol: underlyingToken.symbol,
                    amount: amountDebt,
                    amountUSD: underlyingPrice ? underlyingPrice * Number(amountDebt) : undefined,
                  },
                  collateral: {
                    assetId: collateralToken.address,
                    symbol: collateralToken.symbol,
                    amount: amountCollateral,
                    amountUSD: priceCollateral ? priceCollateral * Number(amountCollateral) : undefined,
                  },
                },
              })
              return
            }

            let actionType: DefiEventAction
            let providerAddress = ''
            let underlyingAmount = 0n
            let lpAmount: bigint | undefined

            switch (eventName) {
              case 'Mint':
                actionType = 'mint'
                providerAddress = args.minter
                underlyingAmount = args.mintAmount
                lpAmount = args.mintTokens
                break

              case 'Borrow':
                actionType = 'borrow'
                providerAddress = args.borrower
                underlyingAmount = args.borrowAmount
                break

              case 'Redeem':
                actionType = 'burn'
                providerAddress = args.redeemer
                underlyingAmount = args.redeemAmount
                lpAmount = args.redeemTokens
                break

              case 'RepayBorrow':
                actionType = 'repay'
                providerAddress = args.payer
                underlyingAmount = args.repayAmount
                break

              default:
                // Skip
                return
            }

            const normalizedAmount = formatUnits(underlyingAmount, underlyingToken.decimals)
            const assets: DefiEventAsset[] = [
              {
                assetId: underlyingToken.address,
                symbol: underlyingToken.symbol,
                amount: normalizedAmount,
                amountUSD: underlyingPrice ? underlyingPrice * Number(normalizedAmount) : undefined,
              },
            ]

            const payload: DefiEventPayload = {
              type: 'event',
              id: ulid(),
              marketId: targetMarketAddress,
              protocol: 'moonwell',
              networkId: chainId,
              blockNumber: log.blockNumber,
              blockHash: log.blockHash,
              txHash: log.transactionHash,
              name: actionType,
              data: {
                provider: providerAddress,
                assets: assets,
                ...(lpAmount !== undefined && { lpAmount: lpAmount.toString() }),
              },
            }

            subject.next(payload)
          } catch (decodeError) {
            console.error('[moonwell] Log mapping evaluation failure:', decodeError)
          }
        },
      }),
    )

    // Liquidity
    subs.push(
      blockWithLogs$
        .pipe(
          smartTrigger({
            events$,
            maxStaleBlocks: 1_010,
          }),
        )
        .subscribe({
          next: (block) => updateAllMarkets(BigInt(block.number)),
          error: (err) => console.error('[moonwell] Trigger error:', err),
        }),
    )
    logger.info('[defi:moonwell] Processor started.')
  }

  return {
    start,
    stop: () => {
      subs.forEach((s) => s.unsubscribe())
      subs.length = 0
    },
  }
}
