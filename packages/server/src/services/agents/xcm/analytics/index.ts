import { DuckDBInstance } from '@duckdb/node-api'
import { LRUCache } from 'lru-cache'

import { ControlQuery } from '@/common/index.js'
import { Logger } from '@/services/types.js'
import { Subscription, filter } from 'rxjs'
import { DataSteward } from '../../steward/agent.js'
import { AssetMetadata, StewardQueryArgs } from '../../steward/types.js'
import { AgentCatalog, QueryParams, QueryResult } from '../../types.js'
import { matchNotificationType, notificationTypeCriteria } from '../ops/criteria.js'
import { XcmTracker } from '../tracking.js'
import { XcmReceived, XcmTerminusContext } from '../types.js'
import { normalizeAssetId } from './melburne.js'
import { XcmTransfersRepository } from './repositories/transfers.js'
import {
  $XcmQueryArgs,
  DepositAsset,
  ExportMessage,
  HopTransfer,
  MultiAsset,
  NewXcmTransfer,
  QueryableXcmAsset,
  XcmAssetWithMetadata,
  XcmQueryArgs,
  XcmV3MultiLocation,
  XcmVersionedInstructions,
  isConcrete,
} from './types.js'

export class XcmAnalytics {
  readonly #log: Logger
  readonly #cache: LRUCache<string, XcmAssetWithMetadata, unknown>
  readonly #db: DuckDBInstance
  readonly #catalog: AgentCatalog

  #steward?: DataSteward
  #repository?: XcmTransfersRepository
  #sub?: Subscription

  constructor({ log, catalog, db }: { log: Logger; catalog: AgentCatalog; db: DuckDBInstance }) {
    this.#cache = new LRUCache({
      ttl: 3_600_000,
      ttlResolution: 1_000,
      ttlAutopurge: false,
      max: 1_000,
    })
    this.#db = db
    this.#log = log
    this.#catalog = catalog
  }

  async start(tracker: XcmTracker) {
    this.#log.info('[xcm:analytics] start')

    this.#steward = this.#catalog.getQueryableById<DataSteward>('steward')

    this.#repository = new XcmTransfersRepository(await this.#db.connect())
    await this.#repository.migrate()

    // XXX: experimental phantom subscription
    const typeCriteria = ControlQuery.from(notificationTypeCriteria(['xcm.received']))
    this.#sub = tracker.xcm$
      .pipe(
        filter((payload) => {
          return matchNotificationType(typeCriteria, payload.type)
        }),
      )
      .subscribe({
        next: (message) => {
          this.#onXcmReceived(message as XcmReceived)
        },
        error: (error) => {
          this.#log.error(error, '[xcm:analytics] error on tracker stream')
        },
      })
  }

  stop() {
    this.#log.info('[xcm:analytics] stop')

    this.#sub?.unsubscribe()
    this.#repository?.close()
  }

  async query(params: QueryParams<XcmQueryArgs>): Promise<QueryResult> {
    if (this.#repository) {
      const { args } = params
      $XcmQueryArgs.parse(args)

      if (args.op === 'transfers_total') {
        return { items: await this.#repository.totalTransfers(args.criteria) }
      }

      if (args.op === 'transfers_count_series') {
        return { items: await this.#repository.transfers(args.criteria) }
      }

      if (args.op === 'transfers_amount_by_asset_series') {
        return { items: await this.#repository.amountByAsset(args.criteria) }
      }
    }

    return { items: [] }
  }

  #onXcmReceived(message: XcmReceived) {
    this.#fromXcmReceived(message)
      .then((transfers) => {
        for (const transfer of transfers) {
          try {
            this.#repository?.insert(transfer)
          } catch (error) {
            this.#log.error(error, '[xcm:analytics] error while inserting')
          }
        }
      })
      .catch((error: unknown) => {
        this.#log.error(error)
      })
  }

  async #fromXcmReceived(message: XcmReceived): Promise<NewXcmTransfer[]> {
    const transfers: NewXcmTransfer[] = []

    const { sender, origin, destination, messageId } = message
    const versioned = (origin.instructions as unknown as XcmVersionedInstructions).value

    const hopTransfer = versioned.find(
      (op) =>
        op.type === 'InitiateReserveWithdraw' ||
        op.type === 'InitiateTeleport' ||
        op.type === 'DepositReserveAsset' ||
        op.type === 'TransferReserveAsset',
    )
    const bridgeMessage = versioned.find((op) => op.type === 'ExportMessage')

    if (
      versioned.find((op) => op.type === 'WithdrawAsset' || op.type === 'ReserveAssetDeposited') ||
      versioned.find((op) => op.type === 'ReceiveTeleportedAsset') ||
      hopTransfer ||
      bridgeMessage
    ) {
      // Extract beneficiary
      let deposit = versioned.find((op) => op.type === 'DepositAsset')
      if (deposit === undefined) {
        if (hopTransfer) {
          deposit = (hopTransfer.value as unknown as HopTransfer).xcm.find((op) => op.type === 'DepositAsset')
        } else if (bridgeMessage) {
          deposit = (bridgeMessage.value as unknown as ExportMessage).xcm.find(
            (op) => op.type === 'DepositAsset',
          )
        }
      }

      let beneficiary = 'unknown'

      if (deposit !== undefined) {
        const interiorValue = (deposit.value as unknown as DepositAsset).beneficiary.interior.value

        let maybeMultiAddress = interiorValue

        if (interiorValue && Array.isArray(interiorValue)) {
          maybeMultiAddress = interiorValue[0]
        }

        if (maybeMultiAddress.type === 'AccountId32') {
          beneficiary = maybeMultiAddress.value.id
        } else if (maybeMultiAddress.type === 'AccountKey20') {
          beneficiary = maybeMultiAddress.value.key
        } else if (maybeMultiAddress.type === 'Parachain') {
          beneficiary = 'paraid:' + maybeMultiAddress.value
        }
      }

      // Extract assets
      const assets: QueryableXcmAsset[] = []
      const _instruction = versioned.find(
        (op) =>
          (op.type === 'ReserveAssetDeposited') !== undefined ||
          (op.type === 'ReceiveTeleportedAsset') !== undefined ||
          (op.type === 'WithdrawAsset') !== undefined,
      )
      if (
        _instruction !== undefined &&
        !hopTransfer &&
        !bridgeMessage // hops and bridged assets need to be handled differently T.T
      ) {
        const multiAssets = _instruction.value as unknown as MultiAsset[]
        if (multiAssets !== undefined) {
          for (const multiAsset of multiAssets) {
            const { id, fun } = multiAsset
            // non-fungible assets not supported
            if (fun.type !== 'Fungible') {
              continue
            }

            let multiLocation: XcmV3MultiLocation | undefined
            if (isConcrete(id)) {
              multiLocation = id.value
            } else {
              multiLocation = id
            }

            // abstract asset ids not supported
            if (multiLocation !== undefined) {
              const location = JSON.stringify(multiLocation, (_, value) =>
                typeof value === 'string' ? value.replaceAll(',', '') : value,
              )
              const amount = BigInt(fun.value.replaceAll(',', ''))
              assets.push({
                location,
                amount,
              })
            }
          }
        }
      }

      const signer = sender?.signer
      const from = signer ? (signer.id as string) : origin.chainId
      const to = beneficiary
      const recvAt = (destination as XcmTerminusContext).timestamp ?? Date.now()
      const sentAt = origin.timestamp ?? Date.now()
      const resolvedAssets = await this.#resolveAssetsMetadata(destination.chainId, assets)

      for (const asset of resolvedAssets) {
        transfers.push({
          from,
          to,
          recvAt,
          sentAt,
          asset: asset.id,
          symbol: asset.symbol,
          decimals: asset.decimals,
          amount: asset.amount,
          origin: origin.chainId,
          destination: destination.chainId,
          correlationId: messageId ?? origin.messageHash,
        })
      }
    }

    return transfers
  }

  async #resolveAssetsMetadata(
    xcmLocationAnchor: string,
    assets: QueryableXcmAsset[],
  ): Promise<XcmAssetWithMetadata[]> {
    if (assets.length === 0) {
      return []
    }

    const partiallyResolved = assets.map((a) => {
      const key = `${xcmLocationAnchor}:${a.location}`
      return this.#cache.get(key)
    })
    const toLocationsToResolve = assets
      .filter((_, index) => partiallyResolved[index] === undefined)
      .map((a) => a.location)

    const assetsWithMetadata = partiallyResolved.filter((a) => a !== undefined)

    if (toLocationsToResolve.length > 0) {
      const { items } = (await this.#steward?.query({
        args: {
          op: 'assets.by_location',
          criteria: [
            {
              xcmLocationAnchor,
              locations: toLocationsToResolve,
            },
          ],
        },
      } as QueryParams<StewardQueryArgs>)) as QueryResult<AssetMetadata>

      for (const [index, metadata] of items.entries()) {
        const assetId = `${metadata.chainId}|${normalizeAssetId(metadata.id)}`
        const key = `${xcmLocationAnchor}:${assets[index].location}`

        if (metadata !== null) {
          const resolved = {
            id: assetId,
            amount: assets[index].amount,
            decimals: metadata.decimals || 0,
            symbol: metadata.symbol || 'TOKEN',
          }
          assetsWithMetadata.push(resolved)
          this.#cache.set(key, resolved)
        } else {
          // unknown token
          assetsWithMetadata.push({
            id: assetId,
            amount: assets[index].amount,
            decimals: 0,
            symbol: 'UNITS',
          })
        }
      }
    }

    return assetsWithMetadata
  }
}
