import { asPublicKey } from '@/common/util.js'
import { QueryParams, QueryResult } from '@/lib.js'
import { getRelayId } from '@/services/config.js'
import { SubstrateIngressConsumer } from '@/services/networking/substrate/ingress/types.js'
import { SubstrateNetworkInfo } from '@/services/networking/substrate/types.js'
import { AnyJson, Logger, NetworkURN } from '@/services/types.js'
import { fromBufferToBase58 } from '@polkadot-api/substrate-bindings'
import { LRUCache } from 'lru-cache'
import { fromHex } from 'polkadot-api/utils'
import { firstValueFrom } from 'rxjs'
import { normalizeAssetId } from '../../common/melbourne.js'
import { DataSteward } from '../../steward/agent.js'
import { AssetMetadata, StewardQueryArgs } from '../../steward/types.js'
import { TickerAgent } from '../../ticker/agent.js'
import { AggregatedPriceData, TickerQueryArgs } from '../../ticker/types.js'
import { HumanizedXcmPayload, XcmMessagePayload } from '../types/index.js'
import {
  DepositAsset,
  ExportMessage,
  HopTransfer,
  HumanizedAddresses,
  HumanizedTransactCall,
  MultiAsset,
  QueryableXcmAsset,
  Transact,
  XcmAsset,
  XcmAssetWithMetadata,
  XcmInstruction,
  XcmVersionedInstructions,
  isConcrete,
} from './types.js'
import { HumanizedXcm, XcmJourneyType } from './types.js'

const DEFAULT_SS58_PREFIX = 42

export class XcmHumanizer {
  readonly #log: Logger
  readonly #cache: LRUCache<string, Omit<XcmAssetWithMetadata, 'amount'>, unknown>
  readonly #priceCache: LRUCache<string, number, unknown>
  readonly #ss58Cache: LRUCache<string, number, unknown>
  readonly #steward: DataSteward
  readonly #ticker: TickerAgent
  readonly #ingress: SubstrateIngressConsumer

  constructor({
    log,
    ingress,
    deps,
  }: {
    log: Logger
    ingress: SubstrateIngressConsumer
    deps: {
      steward: DataSteward
      ticker: TickerAgent
    }
  }) {
    this.#log = log
    this.#ingress = ingress
    this.#steward = deps.steward
    this.#ticker = deps.ticker

    this.#cache = new LRUCache({
      ttl: 3_600_000,
      ttlResolution: 1_000,
      ttlAutopurge: false,
      max: 1_000,
    })
    this.#priceCache = new LRUCache({
      ttl: 900_000,
      ttlResolution: 1_000,
      ttlAutopurge: false,
      max: 100,
    })
    this.#ss58Cache = new LRUCache({
      ttl: 86_400_000,
      ttlResolution: 300_000,
      ttlAutopurge: false,
      max: 100,
    })
  }

  async start() {
    const { items } = (await this.#steward.query({
      pagination: {
        limit: 100
      },
      args: { op: 'chains.list' },
    })) as QueryResult<SubstrateNetworkInfo>

    items.forEach(({ ss58Prefix, urn }) => {
      const prefix = ss58Prefix === undefined || ss58Prefix === null ? this.resolveRelayPrefix(urn, items) : ss58Prefix
      this.#ss58Cache.set(urn, prefix)
    })
  }

  async humanize(message: XcmMessagePayload): Promise<HumanizedXcmPayload> {
    return {
      ...message,
      humanized: await this.#humanizePayload(message),
    }
  }

  async #humanizePayload(message: XcmMessagePayload): Promise<HumanizedXcm> {
    const { sender, origin, destination, legs } = message
    const versioned = origin.instructions as XcmVersionedInstructions
    const version = versioned.type
    const instructions = versioned.value
    const type = this.determineJourneyType(instructions)
    const beneficiary = this.extractBeneficiary(instructions)
    const transactCalls = await this.extractTransactCall(instructions, destination.chainId)

    const from = await this.toAddresses(origin.chainId, sender?.signer?.publicKey)
    const to = await this.toAddresses(destination.chainId, beneficiary)
    const exportMessage = this.findExportMessage(instructions)
    if (exportMessage) {
      return this.handleBridgeMessage(exportMessage, type, from, to, version)
    }

    const assets = this.extractAssets(instructions)
    const resolvedAssets = await this.resolveAssets(legs, destination.chainId, assets)

    return { type, from, to, assets: resolvedAssets, version, transactCalls }
  }

  private async resolveAssets(
    legs: any[],
    destinationChainId: string,
    assets: QueryableXcmAsset[],
  ): Promise<XcmAsset[]> {
    const anchor = legs.length === 1 ? destinationChainId : legs[0]?.to
    if (!anchor) {
      return []
    }
    const resolved = await this.resolveAssetsMetadata(anchor, assets)
    return Promise.all(
      resolved.map(async (asset) => ({
        ...asset,
        volume: await this.resolveVolume(asset),
      })),
    )
  }

  private async resolveAssetsMetadata(
    anchor: string,
    assets: QueryableXcmAsset[],
  ): Promise<XcmAssetWithMetadata[]> {
    if (assets.length === 0) {
      return []
    }

    const partiallyResolved = this.getCachedAssets(anchor, assets)
    const assetsToResolve = this.getAssetsToResolve(assets, partiallyResolved)
    const resolvedAssets = partiallyResolved.filter((asset) => asset !== undefined)

    if (assetsToResolve.length > 0) {
      const metadataItems = await this.fetchAssetMetadata(anchor, assetsToResolve)
      this.updateCacheAndResolveAssets(anchor, assetsToResolve, metadataItems, resolvedAssets)
    }

    return resolvedAssets
  }

  private getCachedAssets(anchor: string, assets: QueryableXcmAsset[]): (XcmAssetWithMetadata | undefined)[] {
    return assets.map((asset) => {
      const key = `${anchor}:${asset.location}`
      const cached = this.#cache.get(key)
      return cached ? { ...cached, amount: asset.amount } : undefined
    })
  }

  private getAssetsToResolve(
    assets: QueryableXcmAsset[],
    partiallyResolved: (XcmAssetWithMetadata | undefined)[],
  ): QueryableXcmAsset[] {
    return assets.filter((_, index) => partiallyResolved[index] === undefined)
  }

  private async fetchAssetMetadata(
    anchor: string,
    assetsToResolve: QueryableXcmAsset[],
  ): Promise<AssetMetadata[]> {
    const locations = assetsToResolve.map((asset) => asset.location)
    const { items } = (await this.#steward.query({
      args: {
        op: 'assets.by_location',
        criteria: [{ xcmLocationAnchor: anchor, locations }],
      },
    } as QueryParams<StewardQueryArgs>)) as QueryResult<AssetMetadata>
    return items
  }

  private updateCacheAndResolveAssets(
    anchor: string,
    assetsToResolve: QueryableXcmAsset[],
    metadataItems: AssetMetadata[],
    resolvedAssets: XcmAssetWithMetadata[],
  ): void {
    for (const [index, metadata] of metadataItems.entries()) {
      const asset = assetsToResolve[index]
      const key = `${anchor}:${asset.location}`
      const assetId = `${metadata.chainId}|${normalizeAssetId(metadata.id)}`

      const resolved = metadata
        ? {
            id: assetId,
            amount: asset.amount,
            decimals: metadata.decimals || 0,
            symbol: metadata.symbol || 'TOKEN',
          }
        : { id: assetId, amount: asset.amount, decimals: 0, symbol: 'UNITS' }

      resolvedAssets.push(resolved)
      this.#cache.set(key, resolved)
    }
  }

  private async resolveVolume(asset: XcmAssetWithMetadata): Promise<number | undefined> {
    const cachedPrice = this.#priceCache.get(asset.id)
    if (cachedPrice !== undefined) {
      return this.calculateVolume(asset, cachedPrice)
    }

    const price = await this.fetchAssetPrice(asset)
    if (price !== null) {
      this.#priceCache.set(asset.id, price)
    }

    return price !== null ? this.calculateVolume(asset, price) : undefined
  }

  private async fetchAssetPrice(asset: XcmAssetWithMetadata): Promise<number | null> {
    const [chainId, assetId] = asset.id.split('|')
    const { items } = (await this.#ticker.query({
      args: {
        op: 'prices.by_asset',
        criteria: [{ chainId, assetId }],
      },
    } as QueryParams<TickerQueryArgs>)) as QueryResult<AggregatedPriceData>
    return items.length > 0 ? items[0].aggregatedPrice : null
  }

  private calculateVolume(asset: XcmAssetWithMetadata, price: number): number {
    const normalizedAmount = Number(asset.amount) / 10 ** asset.decimals
    return normalizedAmount * price
  }

  private determineJourneyType(instructions: XcmInstruction[]): XcmJourneyType {
    const exportMessage = this.findExportMessage(instructions)
    if (exportMessage) {
      return this.determineJourneyType((exportMessage.value as ExportMessage).xcm)
    }

    if (instructions.some((op) => op.type === 'Transact')) {
      return XcmJourneyType.Transact
    }
    if (instructions.some((op) => op.type === 'QueryResponse')) {
      return XcmJourneyType.QueryResponse
    }
    if (
      instructions.some((op) => ['WithdrawAsset', 'ReserveAssetDeposited'].includes(op.type)) &&
      instructions.some((op) => ['DepositAsset', 'DepositReserveAsset'].includes(op.type))
    ) {
      return XcmJourneyType.Transfer
    }
    if (instructions.some((op) => op.type === 'ReceiveTeleportedAsset')) {
      return XcmJourneyType.Teleport
    }

    return XcmJourneyType.Unknown
  }

  private extractBeneficiary(instructions: XcmInstruction[]): string | null {
    const deposit = this.findDeposit(instructions)
    if (!deposit) {
      return null
    }

    const interiorValue = (deposit.value as DepositAsset).beneficiary.interior.value
    const multiAddress = Array.isArray(interiorValue) ? interiorValue[0] : interiorValue

    return this.resolveMultiAddress(multiAddress)
  }

  private resolveMultiAddress(multiAddress: any): string | null {
    if (multiAddress.type === 'AccountId32') {
      return asPublicKey(multiAddress.value.id)
    }
    if (multiAddress.type === 'AccountKey20') {
      return multiAddress.value.key
    }
    if (multiAddress.type === 'Parachain') {
      return `paraid:${multiAddress.value}`
    }
    return null
  }

  private findDeposit(instructions: XcmInstruction[]): XcmInstruction | undefined {
    const hopTransfer = instructions.find((op) =>
      ['InitiateReserveWithdraw', 'InitiateTeleport', 'DepositReserveAsset', 'TransferReserveAsset'].includes(
        op.type,
      ),
    )
    const bridgeMessage = this.findExportMessage(instructions)

    let deposit = instructions.find((op) => op.type === 'DepositAsset')
    if (!deposit && hopTransfer) {
      deposit = (hopTransfer.value as unknown as HopTransfer).xcm.find((op) => op.type === 'DepositAsset')
    }
    if (!deposit && bridgeMessage) {
      deposit = (bridgeMessage.value as ExportMessage).xcm.find((op) => op.type === 'DepositAsset')
    }

    return deposit
  }

  private extractAssets(instructions: XcmInstruction[]): QueryableXcmAsset[] {
    const filteredOps = instructions.filter((op) =>
      ['ReserveAssetDeposited', 'ReceiveTeleportedAsset', 'WithdrawAsset'].includes(op.type),
    )
    if (!filteredOps.length) {
      return []
    }

    const multiAssets = filteredOps.flatMap((op) => op.value as unknown as MultiAsset[])
    return multiAssets
      .filter((asset) => asset.fun.type === 'Fungible')
      .map((asset) => ({
        location: this.extractLocation(asset.id),
        amount: BigInt(asset.fun.value.replaceAll(',', '')),
      }))
  }

  private extractLocation(id: MultiAsset['id']): string {
    const multiLocation = isConcrete(id) ? id.value : id
    return multiLocation
      ? JSON.stringify(multiLocation, (_, value) =>
          typeof value === 'string' ? value.replaceAll(',', '') : value,
        )
      : ''
  }

  private findExportMessage(instructions: XcmInstruction[]): XcmInstruction | undefined {
    return instructions.find((op) => op.type === 'ExportMessage')
  }

  private handleBridgeMessage(
    exportMessage: XcmInstruction,
    type: XcmJourneyType,
    from: HumanizedAddresses,
    to: HumanizedAddresses,
    version: string,
  ): Promise<HumanizedXcm> {
    const { network, xcm } = exportMessage.value as ExportMessage
    const anchor = this.extractExportDestination(network)
    if (!anchor) {
      return Promise.resolve({ type, from, to, assets: [], version, transactCalls: [] })
    }

    return this.resolveAssetsMetadata(anchor, this.extractAssets(xcm)).then((bridgeAssets) =>
      Promise.all(
        bridgeAssets.map(async (asset) => ({
          ...asset,
          volume: await this.resolveVolume(asset),
        })),
      ).then((assets) => ({ type, from, to, assets, version, transactCalls: [] })),
    )
  }

  private extractExportDestination(network?: { type: string; value: AnyJson }): string | null {
    if (!network?.value || typeof network.value !== 'object' || !('chain_id' in network.value)) {
      return null
    }
    return `urn:ocn:${network.type.toLowerCase()}:${network.value.chain_id}`
  }

  private async extractTransactCall(
    instructions: XcmInstruction[],
    chainId: NetworkURN,
  ): Promise<HumanizedTransactCall[]> {
    const humanized: HumanizedTransactCall[] = []
    const transacts = instructions.filter((op) => op.type === 'Transact')
    if (transacts.length > 0) {
      for (const t of transacts) {
        const callData = (t.value as Transact).call
        try {
          const apiContext = this.#ingress.getContext(chainId)
          const decodedCall = (await firstValueFrom(apiContext)).decodeCall(callData)
          humanized.push({ ...decodedCall, raw: callData })
        } catch (error) {
          this.#log.error(error, 'Error decoding call from data %s (chainId: %s)', callData, chainId)
          humanized.push({
            raw: callData,
          })
        }
      }
    }
    return humanized
  }

  private async toAddresses(chainId: NetworkURN, publicKey?: string | null): Promise<HumanizedAddresses> {
    if (publicKey) {
      if (publicKey.length === 42) {
        // EVM address
        return {
          key: publicKey,
        }
      }
      let prefix = this.#ss58Cache.get(chainId)

      if (prefix === undefined) {
        prefix = await this.fetchPrefix(chainId)
        this.#ss58Cache.set(chainId, prefix)
      }

      return {
        key: publicKey,
        formatted: fromBufferToBase58(prefix)(fromHex(publicKey)),
      }
    }

    return {
      key: chainId,
    }
  }

  private resolveRelayPrefix(urn: NetworkURN, items: SubstrateNetworkInfo[]): number {
    const relay = getRelayId(urn)
    return this.#ss58Cache.get(relay) ?? items.find((i) => i.urn === relay)?.ss58Prefix ?? DEFAULT_SS58_PREFIX
  }

  private async fetchPrefix(chainId: NetworkURN): Promise<number> {
    const { items } = (await this.#steward.query({
      args: {
        op: 'chains',
        criteria: {
          networks: [chainId],
        },
      },
    })) as QueryResult<SubstrateNetworkInfo>

    const chainInfo = items.find((item) => item.urn === chainId)
    return chainInfo?.ss58Prefix ?? DEFAULT_SS58_PREFIX
  }
}
