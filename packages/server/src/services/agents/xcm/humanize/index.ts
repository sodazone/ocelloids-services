import EventEmitter from 'node:events'
import { fromBufferToBase58 } from '@polkadot-api/substrate-bindings'
import { LRUCache } from 'lru-cache'
import { fromHex } from 'polkadot-api/utils'
import { firstValueFrom } from 'rxjs'

import { asPublicKey, normalizePublicKey } from '@/common/util.js'
import { QueryParams, QueryResult } from '@/lib.js'
import { getConsensus } from '@/services/config.js'
import { SubstrateIngressConsumer } from '@/services/networking/substrate/ingress/types.js'
import { AnyJson, Logger, NetworkURN } from '@/services/types.js'

import { normalizeAssetId } from '../../common/melbourne.js'
import { DataSteward } from '../../steward/agent.js'
import { fetchSS58Prefix } from '../../steward/metadata/queries/helper.js'
import {
  AssetMetadata,
  Empty,
  isAssetMetadata,
  StewardQueries,
  StewardQueryArgs,
} from '../../steward/types.js'
import { TickerAgent } from '../../ticker/agent.js'
import { AggregatedPriceData, TickerQueryArgs } from '../../ticker/types.js'
import { getParaIdFromJunctions, networkIdFromMultiLocation } from '../ops/util.js'
import {
  AssetSwap,
  AssetsTrapped,
  HumanizedXcmPayload,
  SnowbridgeOutboundAsset,
  SwappedAsset,
  XcmMessagePayload,
  XcmTerminus,
  XcmTerminusContext,
} from '../types/index.js'
import { TelemetryXcmHumanizerEmitter, xcmHumanizerMetrics } from './telemetry.js'
import {
  DepositAsset,
  ExchangeAsset,
  ExportMessage,
  HopTransfer,
  HumanizedAddresses,
  HumanizedTransactCall,
  HumanizedXcm,
  HumanizedXcmAsset,
  InitiateReserveWithdraw,
  InitiateTeleport,
  InitiateTransfer,
  MultiAsset,
  QueryableXcmAsset,
  Transact,
  XcmAssetWithMetadata,
  XcmInstruction,
  XcmJourneyType,
  XcmVersionedInstructions,
} from './types.js'
import { extractMultiAssetFilterAssets, parseMultiAsset, stringifyMultilocation } from './utils.js'

const HOP_INSTRUCTIONS = [
  'InitiateReserveWithdraw',
  'InitiateTeleport',
  'DepositReserveAsset',
  'TransferReserveAsset',
]

type SwapAssetFromExchangeAssets = QueryableXcmAsset & {
  matchAmount: boolean
  meta: {
    network: NetworkURN
  }
}

export class XcmHumanizer {
  readonly #log: Logger
  readonly #cache: LRUCache<string, Omit<XcmAssetWithMetadata, 'amount'>, unknown>
  readonly #priceCache: LRUCache<string, number, unknown>
  readonly #steward: DataSteward
  readonly #ticker: TickerAgent
  readonly #ingress: SubstrateIngressConsumer
  readonly #stewardQuery: StewardQueries
  readonly #telemetry: TelemetryXcmHumanizerEmitter

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
    this.#stewardQuery = this.#steward.query.bind(this.#steward)
    this.#ticker = deps.ticker
    this.#telemetry = new (EventEmitter as new () => TelemetryXcmHumanizerEmitter)()

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
  }

  async start() {
    if (this.#steward === undefined) {
      return
    }
  }

  async humanize(message: XcmMessagePayload): Promise<HumanizedXcmPayload> {
    return {
      ...message,
      humanized: await this.#humanizePayload(message),
    }
  }

  collectTelemetry() {
    xcmHumanizerMetrics(this.#telemetry)
  }

  async #humanizePayload(message: XcmMessagePayload): Promise<HumanizedXcm> {
    if (message.partialHumanized !== undefined && message.partialHumanized !== null) {
      const { sender, origin, destination } = message
      const { beneficiary, asset } = message.partialHumanized
      const from = await this.#toAddresses(origin.chainId, sender?.signer?.publicKey)
      const to = await this.#toAddresses(destination.chainId, normalizePublicKey(beneficiary))
      const resolvedAsset = await this.#resolveSnowbridgeAsset(asset)
      return { type: XcmJourneyType.Transfer, from, to, assets: [resolvedAsset], transactCalls: [] }
    }
    const { sender, origin, destination, legs, waypoint } = message
    const { assetSwaps, assetsTrapped, legIndex } = waypoint
    const versioned = (waypoint.instructions ?? origin.instructions) as XcmVersionedInstructions
    if (!versioned) {
      throw new Error('No instructions or partial humanized data found in XCM message')
    }
    const version = versioned.type
    const instructions = versioned.value
    const type = this.#determineJourneyType(instructions)
    const beneficiary = this.#extractBeneficiary(instructions, destination.chainId)
    const transactCalls = await this.#extractTransactCall(instructions, destination)

    const from = await this.#toAddresses(origin.chainId, sender?.signer?.publicKey)
    const to = await this.#toAddresses(destination.chainId, beneficiary)
    const exportMessage = this.#findExportMessage(instructions)
    if (exportMessage) {
      return this.#handleBridgeMessage(exportMessage, type, from, to, version)
    }

    const xcmLocationAnchor = legs.length === 1 ? destination.chainId : legs[0]?.to
    const assets = this.#extractAssetsFromTransfer(instructions)
    const resolvedAssets = assets.length > 0 ? await this.#resolveAssets(xcmLocationAnchor, assets) : []

    // Assumption: Swap instruction is on the top level
    // TODO: recursive extract of exchange instructions
    // will need to correlate the swap location to assetSwap waypoint location
    if (type === XcmJourneyType.Swap) {
      const swapAssetsFromInstructions = this.#extractExchangeAssets(instructions, xcmLocationAnchor)
      let swappedAssets: SwapAssetFromExchangeAssets[] = []
      if (assetSwaps !== undefined && assetSwaps.length > 0) {
        const swapAssetsAtWaypoint = swapAssetsFromInstructions.filter(
          (a) => a.meta.network === waypoint.chainId,
        )
        swappedAssets = await this.#mapSwappedValue(swapAssetsAtWaypoint, assetSwaps, xcmLocationAnchor)
      } else if (
        message.type === 'xcm.sent' ||
        // Since sometimes the relayed message arrives first in the explorer stream
        // we want to apply the swap assets from instructions to the relay message of the first leg
        (message.type === 'xcm.relayed' && legIndex === 0)
      ) {
        swappedAssets = swapAssetsFromInstructions
      }
      if (swappedAssets.length > 0) {
        const groupedByNetwork = swappedAssets.reduce(
          (acc, asset) => {
            const anchor = asset.meta.network
            if (!acc[anchor]) {
              acc[anchor] = []
            }
            acc[anchor].push(asset)
            return acc
          },
          {} as Record<NetworkURN, QueryableXcmAsset[]>,
        )

        for (const [anchor, assets] of Object.entries(groupedByNetwork)) {
          const resolved = await this.#resolveAssets(anchor as NetworkURN, assets)
          resolvedAssets.push(...resolved)
        }
      }
    }

    if (assetsTrapped !== undefined && assetsTrapped !== null) {
      const trapped = this.#extractTrappedAssets(assetsTrapped as AssetsTrapped)
      if (trapped.length > 0) {
        resolvedAssets.push(...(await this.#resolveAssets(waypoint.chainId, trapped)))
      }
    }

    if (type === XcmJourneyType.Unknown) {
      this.#telemetry.emit('telemetryXcmTypeUnresolved', message, version)
    }
    if (instructions.find((op) => op.type === 'InitiateTransfer') !== undefined) {
      this.#telemetry.emit('telemetryXcmInstruction', message, 'InitiateTransfer')
    }

    return { type, from, to, assets: resolvedAssets, version, transactCalls }
  }

  #extractTrappedAssets(assetsTrapped: AssetsTrapped): QueryableXcmAsset[] {
    const trappedQueryableAssets: QueryableXcmAsset[] = []

    for (const asset of assetsTrapped.assets) {
      if (asset.fungible && asset.id?.type === 'Concrete') {
        trappedQueryableAssets.push({
          location: stringifyMultilocation(asset.id.value),
          amount: BigInt(asset.amount),
          role: 'trapped',
        })
      }
    }
    return trappedQueryableAssets
  }

  async #mapSwappedValue(
    swapAssetsFromInstructions: SwapAssetFromExchangeAssets[],
    assetSwaps: AssetSwap[],
    anchor: NetworkURN,
  ): Promise<SwapAssetFromExchangeAssets[]> {
    const swappedAssets: SwapAssetFromExchangeAssets[] = []

    // Group assets by sequence into pairs
    const groupedBySequence = new Map<
      number,
      { swap_in?: SwapAssetFromExchangeAssets; swap_out?: SwapAssetFromExchangeAssets }
    >()
    for (const asset of swapAssetsFromInstructions) {
      if (asset.sequence !== undefined) {
        if (!groupedBySequence.has(asset.sequence)) {
          groupedBySequence.set(asset.sequence, {})
        }
        const pair = groupedBySequence.get(asset.sequence)!
        if (asset.role === 'swap_in') {
          pair.swap_in = asset
        } else if (asset.role === 'swap_out') {
          pair.swap_out = asset
        }
      } else {
        // Keep assets without sequence (e.g. 'transfer') as-is
        swappedAssets.push(asset)
      }
    }

    for (const pair of groupedBySequence.values()) {
      const { swap_in, swap_out } = pair
      if (!swap_in || !swap_out) {
        // Incomplete pair, push original (fallback)
        if (swap_in) {
          swappedAssets.push(swap_in)
        }
        if (swap_out) {
          swappedAssets.push(swap_out)
        }
        continue
      }

      let match: AssetSwap | undefined = undefined
      if (assetSwaps) {
        for (const swap of assetSwaps) {
          if (
            (await this.#matchAssets(swap.assetIn, swap_in, anchor)) &&
            (await this.#matchAssets(swap.assetOut, swap_out, anchor))
          ) {
            match = swap
            break
          }
        }
      }

      if (match) {
        swappedAssets.push({
          ...swap_in,
          amount: BigInt(match.assetIn.amount),
        })
        swappedAssets.push({
          ...swap_out,
          amount: BigInt(match.assetOut.amount),
        })
      }
    }
    return swappedAssets
  }

  async #matchAssets(
    assetFromSwapEvent: SwappedAsset,
    assetFromInstruction: SwapAssetFromExchangeAssets,
    anchor: NetworkURN,
  ): Promise<boolean> {
    const { amount: swapEventAmount, localAssetId } = assetFromSwapEvent
    const { amount: instructionAmount, location, matchAmount } = assetFromInstruction
    if (localAssetId == null) {
      return false
    }

    const tolerance = 10n
    const eventAmount = BigInt(swapEventAmount.toString())
    const amountsMatch =
      !matchAmount ||
      (eventAmount >= instructionAmount - tolerance && eventAmount <= instructionAmount + tolerance)

    if (!amountsMatch) {
      return false
    }

    if (typeof localAssetId === 'object' && 'parents' in localAssetId) {
      const locationStr = stringifyMultilocation(localAssetId)
      return locationStr === location
    }

    if (typeof localAssetId === 'number') {
      const [byId, byLoc] = await Promise.all([
        this.#fetchAssetMetadataById(anchor, [localAssetId.toString()]),
        this.#fetchAssetMetadata(anchor, [{ location }]),
      ])

      if (!isAssetMetadata(byId[0]) || !isAssetMetadata(byLoc[0])) {
        return false
      }

      const idXid = byId[0]?.sourceId?.xid ?? byId[0]?.xid
      const locXid = byLoc[0]?.sourceId?.xid ?? byLoc[0]?.xid

      return idXid === locXid
    }

    return false
  }

  #extractExchangeAssets(
    instructions: XcmInstruction[],
    nextStopId: NetworkURN,
  ): SwapAssetFromExchangeAssets[] {
    const exchangeAssetInstructions = this.#extractExchangeAssetsRecursive(instructions, nextStopId)

    if (exchangeAssetInstructions.length === 0) {
      throw new Error('No ExchangeAsset instruction found in swap journey')
    }

    const assetsInHolding = this.#extractAssetsFromTransfer(instructions)
    const assets: SwapAssetFromExchangeAssets[] = []

    try {
      for (const [i, { instruction, network }] of exchangeAssetInstructions.entries()) {
        const { give, want, maximal } = instruction.value as unknown as ExchangeAsset
        const assetsIn = extractMultiAssetFilterAssets(give, assetsInHolding).map(
          (a) =>
            ({
              ...a,
              role: 'swap_in',
              sequence: i,
              matchAmount: maximal,
              meta: { network },
            }) as SwapAssetFromExchangeAssets,
        )
        const assetsOut = parseMultiAsset(want as MultiAsset[]).map(
          (a) =>
            ({
              ...a,
              role: 'swap_out',
              sequence: i,
              matchAmount: !maximal,
              meta: { network },
            }) as SwapAssetFromExchangeAssets,
        )

        assets.push(...assetsIn)
        assets.push(...assetsOut)
        // Following the assumption that the ExchangeAssets instructions are all on the same level,
        // the out of each swap, could be the in of the next swap
        assetsInHolding.push(...assetsOut)
      }
    } catch (err) {
      this.#log.error(
        err,
        '[humanizer] Error extracting assets from ExchangeAsset %j',
        exchangeAssetInstructions,
      )
    }

    return assets
  }

  async #resolveSnowbridgeAsset({
    chainId,
    id,
    amount,
  }: SnowbridgeOutboundAsset): Promise<HumanizedXcmAsset> {
    const assetId = id === '0x0000000000000000000000000000000000000000' ? 'native' : id
    const assetKey = `${chainId}|${normalizeAssetId(assetId)}`
    const unresolved: XcmAssetWithMetadata = {
      id: assetKey,
      amount: BigInt(amount),
      role: 'transfer',
      sequence: 0,
    }

    const cached = this.#cache.get(assetKey)
    if (cached) {
      const resolved = {
        ...unresolved,
        decimals: cached.decimals,
        symbol: cached.symbol,
      }
      return {
        ...resolved,
        volume: await this.resolveVolume(resolved),
      }
    }

    const results = (await this.#fetchAssetMetadataById(chainId, [assetId])).filter((a) => isAssetMetadata(a))

    if (results.length === 0) {
      return unresolved
    }
    const { decimals, symbol } = results[0]
    const resolved = {
      ...unresolved,
      decimals,
      symbol,
    }
    this.#cache.set(assetKey, resolved)
    return {
      ...resolved,
      volume: await this.resolveVolume(resolved),
    }
  }

  async #resolveAssets(anchor: NetworkURN, assets: QueryableXcmAsset[]): Promise<HumanizedXcmAsset[]> {
    const resolved = await this.#resolveAssetsMetadata(anchor, assets)
    return Promise.all(
      resolved.map(async (asset) => ({
        ...asset,
        volume: await this.resolveVolume(asset),
      })),
    )
  }

  async #resolveAssetsMetadata(
    anchor: NetworkURN,
    assets: QueryableXcmAsset[],
  ): Promise<XcmAssetWithMetadata[]> {
    if (assets.length === 0) {
      return []
    }

    const partiallyResolved = this.#getCachedAssets(anchor, assets)
    const assetsToResolve = assets.filter((_, index) => partiallyResolved[index] === undefined)
    const resolvedAssets = partiallyResolved.filter((asset) => asset !== undefined)

    if (assetsToResolve.length > 0) {
      const metadataItems = await this.#fetchAssetMetadata(anchor, assetsToResolve)
      for (const [index, asset] of assetsToResolve.entries()) {
        const metadata = metadataItems[index]

        if ('id' in metadata && 'chainId' in metadata) {
          const resolved = {
            id: `${metadata.chainId}|${normalizeAssetId(metadata.id)}`,
            amount: asset.amount,
            decimals: metadata.decimals,
            symbol: metadata.symbol,
            role: asset.role,
            sequence: asset.sequence,
          }
          resolvedAssets.push(resolved)
          this.#cache.set(`${anchor}:${asset.location}`, resolved)
        } else {
          resolvedAssets.push({
            id: `${anchor}|${normalizeAssetId(asset.location)}`,
            amount: asset.amount,
            role: asset.role,
            sequence: asset.sequence,
          })
        }
      }
    }

    return resolvedAssets
  }

  #getCachedAssets(anchor: string, assets: QueryableXcmAsset[]): (XcmAssetWithMetadata | undefined)[] {
    return assets.map((asset) => {
      const key = `${anchor}:${asset.location}`
      const cached = this.#cache.get(key)
      return cached
        ? { ...cached, amount: asset.amount, role: asset.role, sequence: asset.sequence }
        : undefined
    })
  }

  async #fetchAssetMetadata(
    anchor: string,
    assetsToResolve: { location: string }[],
  ): Promise<(AssetMetadata | Empty)[]> {
    const locations = assetsToResolve.map((asset) => asset.location)
    const { items } = (await this.#steward.query({
      args: {
        op: 'assets.by_location',
        criteria: [{ xcmLocationAnchor: anchor, locations }],
      },
    } as QueryParams<StewardQueryArgs>)) as QueryResult<AssetMetadata | Empty>
    return items
  }

  async #fetchAssetMetadataById(anchor: string, assetIds: string[]): Promise<(AssetMetadata | Empty)[]> {
    const { items } = (await this.#steward.query({
      args: {
        op: 'assets',
        criteria: [
          {
            network: anchor,
            assets: assetIds,
          },
        ],
      },
    } as QueryParams<StewardQueryArgs>)) as QueryResult<AssetMetadata | Empty>
    return items
  }

  private async resolveVolume(asset: XcmAssetWithMetadata): Promise<number | undefined> {
    const cachedPrice = this.#priceCache.get(asset.id)
    if (cachedPrice !== undefined) {
      return this.#calculateVolume(asset, cachedPrice)
    }

    const price = await this.#fetchAssetPrice(asset)
    if (price !== null) {
      this.#priceCache.set(asset.id, price)
    }

    return this.#calculateVolume(asset, price)
  }

  async #fetchAssetPrice(asset: XcmAssetWithMetadata): Promise<number | null> {
    const [chainId, assetId] = asset.id.split('|')
    console.log('fetching ticker prices', chainId, assetId)
    const { items } = (await this.#ticker.query({
      args: {
        op: 'prices.by_asset',
        criteria: [{ chainId, assetId }],
      },
    } as QueryParams<TickerQueryArgs>)) as QueryResult<AggregatedPriceData>
    return items.length > 0 ? items[0].medianPrice : null
  }

  #calculateVolume(asset: XcmAssetWithMetadata, price: number | null): number | undefined {
    if (price === null || asset.decimals === undefined) {
      return
    }
    const normalizedAmount = Number(asset.amount) / 10 ** asset.decimals
    return normalizedAmount * price
  }

  #determineJourneyType(instructions: XcmInstruction[]): XcmJourneyType {
    const exportMessage = this.#findExportMessage(instructions)
    if (exportMessage) {
      return this.#determineJourneyType((exportMessage.value as ExportMessage).xcm)
    }

    if (this.#hasExchangeAsset(instructions)) {
      return XcmJourneyType.Swap
    }

    const hopMessage = this.#findHopMessage(instructions)
    if (hopMessage) {
      if (
        instructions.some((op) => ['WithdrawAsset', 'ReserveAssetDeposited'].includes(op.type)) &&
        (hopMessage.value as unknown as HopTransfer).xcm.some((op) =>
          ['DepositAsset', 'DepositReserveAsset'].includes(op.type),
        )
      ) {
        return XcmJourneyType.Transfer
      }
      return this.#determineJourneyType((hopMessage.value as unknown as HopTransfer).xcm)
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

  #extractBeneficiary(instructions: XcmInstruction[], network: NetworkURN): string | null {
    const deposit = this.#findDeposit(instructions)
    if (!deposit) {
      return null
    }

    const interiorValue = (deposit.value as DepositAsset).beneficiary.interior.value
    const multiAddress = Array.isArray(interiorValue) ? interiorValue[0] : interiorValue

    if (multiAddress.type === 'Parachain') {
      return `urn:ocn:${getConsensus(network)}:${multiAddress.value}`
    }

    return this.#resolveMultiAddress(multiAddress)
  }

  #resolveMultiAddress(multiAddress: any): string | null {
    if (multiAddress.type === 'AccountId32') {
      return asPublicKey(multiAddress.value.id)
    }
    if (multiAddress.type === 'AccountKey20') {
      return multiAddress.value.key
    }
    return null
  }

  #findDeposit(instructions: XcmInstruction[]): XcmInstruction | undefined {
    for (const instr of instructions) {
      if (instr.type === 'DepositAsset') {
        return instr
      }

      const hopTransfer = this.#findHopMessage(instructions)
      // Recursively search inside known container instruction types
      if (hopTransfer) {
        const nested = (hopTransfer.value as unknown as HopTransfer).xcm
        const found = this.#findDeposit(nested)
        if (found) {
          return found
        }
      }

      const bridgeMessage = this.#findExportMessage(instructions)
      if (bridgeMessage) {
        const nested = (bridgeMessage.value as unknown as ExportMessage).xcm
        const found = this.#findDeposit(nested)
        if (found) {
          return found
        }
      }
    }

    return undefined
  }

  #extractAssetsFromTransfer(instructions: XcmInstruction[]): QueryableXcmAsset[] {
    const filteredOps = instructions.filter((op) =>
      ['ReserveAssetDeposited', 'ReceiveTeleportedAsset', 'WithdrawAsset'].includes(op.type),
    )
    if (!filteredOps.length) {
      return []
    }

    const multiAssets = filteredOps.flatMap((op) => op.value as unknown as MultiAsset[])
    return parseMultiAsset(multiAssets, 'transfer')
  }

  #findExportMessage(instructions: XcmInstruction[]): XcmInstruction | undefined {
    return instructions.find((op) => op.type === 'ExportMessage')
  }

  #findHopMessage(instructions: XcmInstruction[]): XcmInstruction | undefined {
    const initiateTransfer = instructions.find((op) => op.type === 'InitiateTransfer')
    if (initiateTransfer) {
      const msg = initiateTransfer.value as unknown as InitiateTransfer
      return {
        type: '',
        value: {
          dest: msg.destination,
          xcm: msg.remote_xcm,
        },
      }
    }
    return instructions.find((op) => HOP_INSTRUCTIONS.includes(op.type))
  }

  #extractExchangeAssetsRecursive(
    instructions: XcmInstruction[],
    currentNetwork: NetworkURN,
  ): { instruction: XcmInstruction; network: NetworkURN }[] {
    const result: { instruction: XcmInstruction; network: NetworkURN }[] = []

    for (const instruction of instructions) {
      if (instruction.type === 'ExchangeAsset') {
        result.push({ instruction, network: currentNetwork })
      } else if (HOP_INSTRUCTIONS.includes(instruction.type)) {
        const hop = instruction.value as unknown as HopTransfer

        const rawDest =
          instruction.type === 'InitiateReserveWithdraw'
            ? (hop as InitiateReserveWithdraw).reserve
            : (hop as InitiateTeleport).dest
        const nextStop = networkIdFromMultiLocation(
          rawDest as { parents: number; interior: any },
          currentNetwork,
        )
        if (!nextStop) {
          continue
        }

        const nested = this.#extractExchangeAssetsRecursive(hop.xcm, nextStop)
        result.push(...nested)
      }
    }

    return result
  }

  #hasExchangeAsset(instructions: XcmInstruction[]): boolean {
    for (const ins of instructions) {
      if (ins.type === 'ExchangeAsset') {
        return true
      }
      if (HOP_INSTRUCTIONS.includes(ins.type)) {
        const { xcm } = ins.value as unknown as HopTransfer
        return this.#hasExchangeAsset(xcm)
      }
    }
    return false
  }

  async #handleBridgeMessage(
    exportMessage: XcmInstruction,
    type: XcmJourneyType,
    from: HumanizedAddresses,
    to: HumanizedAddresses,
    version: string,
  ): Promise<HumanizedXcm> {
    const { network, xcm, destination } = exportMessage.value as ExportMessage
    const anchor = this.#extractExportDestination(network, destination)
    if (!anchor) {
      return Promise.resolve({ type, from, to, assets: [], version, transactCalls: [] })
    }
    const beneficiary = this.#extractBeneficiary(xcm, anchor)
    const bridgedBeneficiary = beneficiary ? await this.#toAddresses(anchor as NetworkURN, beneficiary) : to

    return this.#resolveAssetsMetadata(anchor, this.#extractAssetsFromTransfer(xcm)).then((bridgeAssets) =>
      Promise.all(
        bridgeAssets.map(async (asset) => ({
          ...asset,
          volume: await this.resolveVolume(asset),
        })),
      ).then((assets) => ({ type, from, to: bridgedBeneficiary, assets, version, transactCalls: [] })),
    )
  }

  #extractExportDestination(
    network?: { type: string; value: AnyJson },
    destination?: {
      type: string
      value: AnyJson
    },
  ): NetworkURN | null {
    if (network === undefined) {
      return null
    }
    if (!network?.value && destination !== undefined) {
      const paraId = getParaIdFromJunctions(destination)
      return `urn:ocn:${network.type.toLowerCase()}:${paraId ?? 0}`
    }
    if (network.value !== null && typeof network.value === 'object' && 'chain_id' in network.value) {
      return `urn:ocn:${network.type.toLowerCase()}:${network.value.chain_id}`
    }
    return null
  }

  async #extractTransactCall(
    instructions: XcmInstruction[],
    destination: XcmTerminusContext | XcmTerminus,
  ): Promise<HumanizedTransactCall[]> {
    const { chainId } = destination
    const specVersion = 'specVersion' in destination ? destination.specVersion : undefined
    const humanized: HumanizedTransactCall[] = []
    const transacts = instructions.filter((op) => op.type === 'Transact')
    if (transacts.length > 0) {
      for (const t of transacts) {
        const callData = (t.value as Transact).call
        try {
          const apiContext = this.#ingress.getContext(chainId, specVersion)
          const decodedCall = (await firstValueFrom(apiContext)).decodeCall(callData)
          humanized.push({ ...decodedCall, raw: callData })
        } catch (error) {
          this.#log.error(
            error,
            '[humanizer] Error decoding call from data %s (chainId: %s, specVersion: %s)',
            callData,
            chainId,
            specVersion ?? 'none',
          )
          humanized.push({
            raw: callData,
          })
          this.#telemetry.emit('telemetryXcmDecodeCallError', chainId, specVersion?.toString() ?? 'none')
        }
      }
    }
    return humanized
  }

  async #toAddresses(chainId: NetworkURN, publicKeyOrParachain?: string | null): Promise<HumanizedAddresses> {
    if (publicKeyOrParachain) {
      if (publicKeyOrParachain.startsWith('urn:ocn')) {
        return {
          key: publicKeyOrParachain,
        }
      }
      if (publicKeyOrParachain.length === 42) {
        // EVM address
        return {
          key: publicKeyOrParachain,
        }
      }

      const prefix = await fetchSS58Prefix(this.#stewardQuery, chainId)

      return {
        key: publicKeyOrParachain,
        formatted: fromBufferToBase58(prefix)(fromHex(publicKeyOrParachain)),
      }
    }

    return {
      key: chainId,
    }
  }
}
