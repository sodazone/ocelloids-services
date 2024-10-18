import { GlobalConsensus, createNetworkId, getConsensus, isGlobalConsensus } from '@/services/config.js'
import { BlockEvent, BlockExtrinsic, Extrinsic } from '@/services/networking/index.js'
import { HexString, SignerData } from '@/services/subscriptions/types.js'
import { NetworkURN } from '@/services/types.js'
import { AssetsTrapped, TrappedAsset } from '../types.js'
import { Program } from './xcm-format.js'

// TODO: review this, we don't want to define all not applicable consensus
const BRIDGE_HUB_NETWORK_IDS: Record<GlobalConsensus, NetworkURN | undefined> = {
  polkadot: 'urn:ocn:polkadot:1002',
  kusama: 'urn:ocn:kusama:1002',
  rococo: 'urn:ocn:rococo:1013',
  westend: 'urn:ocn:westend:1002',
  local: 'urn:ocn:local:2000',
  wococo: 'urn:ocn:wococo:1002',
  paseo: undefined,
  chainflip: undefined,
  alephzero: undefined,
  avail: undefined,
  polymesh: undefined,
  ternoa: undefined,
  ethereum: undefined,
  byfork: undefined,
  bygenesis: undefined,
  bitcoincore: undefined,
  bitcoincash: undefined,
}

export function getBridgeHubNetworkId(consensus: string | NetworkURN): NetworkURN | undefined {
  const c = consensus.startsWith('urn:ocn:') ? getConsensus(consensus as NetworkURN) : consensus
  if (isGlobalConsensus(c)) {
    return BRIDGE_HUB_NETWORK_IDS[c]
  }
  return undefined
}

function createSignersData(xt: BlockExtrinsic): SignerData | undefined {
  try {
    if (xt.signed) {
      // Signer could be Address or AccountId
      const accountId = xt.signature.value ?? xt.signature
      return {
        signer: {
          id: accountId,
          publicKey: accountId,
        },
        extraSigners: [],
      }
    }
  } catch (error) {
    throw new Error(`creating signers data at ${xt.blockNumber} ${xt.blockPosition ?? '-1'}`, {
      cause: error,
    })
  }

  return undefined
}

export function getSendersFromExtrinsic(extrinsic: BlockExtrinsic): SignerData | undefined {
  return createSignersData(extrinsic)
}

export function getSendersFromEvent(event: BlockEvent): SignerData | undefined {
  if (event.extrinsic !== undefined) {
    return getSendersFromExtrinsic(event.extrinsic)
  }
  return undefined
}
/**
 * Gets message id from setTopic.
 */
export function getMessageId({ instructions }: Program): HexString | undefined {
  switch (instructions.type) {
    // Only XCM V3+ supports topic ID
    case 'V3':
    case 'V4':
      for (const instruction of instructions.value) {
        if (instruction.type === 'SetTopic') {
          return instruction.value.asHex()
        }
      }
      return undefined
    default:
      return undefined
  }
}

export function getParaIdFromOrigin(origin: { type: string; value: { type: string; value: number } }):
  | string
  | undefined {
  if (origin.type === 'Ump') {
    const umpOrigin = origin.value
    if (umpOrigin.type === 'Para') {
      return umpOrigin.value.toString()
    }
  }

  return undefined
}

// TODO: revisit Junction guards and conversions
// TODO: extract in multiple files

function isX1V2Junctions(object: any): object is XcmV2MultilocationJunctions {
  return (
    object.asX1 !== undefined &&
    typeof object.asX1[Symbol.iterator] !== 'function' &&
    object.asX1.isGlobalConsensus === undefined
  )
}

const Xn = ['X2', 'X3', 'X4', 'X5', 'X6', 'X7', 'X8']
function isXnV2Junctions(object: any): object is XcmV2MultilocationJunctions {
  return Xn.every((x) => {
    const ax = object[`as${x}`]
    return ax === undefined || (Array.isArray(ax) && ax.every((a) => a.isGlobalConsensus === undefined))
  })
}

function isX1V4Junctions(object: any): object is XcmV4Junctions {
  return object.asX1 !== undefined && typeof object.asX1[Symbol.iterator] === 'function'
}

function isX1V3Junctions(object: any): object is XcmV3Junctions {
  return (
    object.asX1 !== undefined &&
    typeof object.asX1[Symbol.iterator] !== 'function' &&
    object.asX1.isGlobalConsensus !== undefined
  )
}

type NetworkId = {
  consensus?: string
  chainId?: string
}

function extractConsensusAndId(j: XcmV3Junction | XcmV4Junction, n: NetworkId) {
  const network = j.asGlobalConsensus
  if (network.type === 'Ethereum') {
    n.consensus = network.type.toLowerCase()
    n.chainId = network.asEthereum.chainId.toString()
  } else if (network.type !== 'ByFork' && network.type !== 'ByGenesis') {
    n.consensus = network.type.toLowerCase()
  }
}

function extractV3X1GlobalConsensus(junctions: XcmV3Junctions, n: NetworkId): NetworkURN | undefined {
  if (junctions.asX1.isGlobalConsensus) {
    extractConsensusAndId(junctions.asX1, n)
    if (n.consensus !== undefined) {
      return createNetworkId(n.consensus, n.chainId ?? '0')
    }
  }
  return undefined
}

function extractV4X1GlobalConsensus(junctions: XcmV4Junctions, n: NetworkId): NetworkURN | undefined {
  const j = junctions.asX1[0]
  if (j.isGlobalConsensus) {
    extractConsensusAndId(j, n)
    if (n.consensus !== undefined) {
      return createNetworkId(n.consensus, n.chainId ?? '0')
    }
  }
  return undefined
}

function _networkIdFrom(junctions: XcmV3Junctions | XcmV4Junctions, networkId: NetworkId) {
  if (junctions.type === 'X1' || junctions.type === 'Here') {
    return undefined
  }

  for (const j of junctions[`as${junctions.type}`]) {
    if (j.isGlobalConsensus) {
      extractConsensusAndId(j, networkId)
    }

    if (j.isParachain) {
      networkId.chainId = j.asParachain.toString()
    }
  }

  if (networkId.consensus !== undefined) {
    return createNetworkId(networkId.consensus, networkId.chainId ?? '0')
  }

  return undefined
}

function networkIdFromV4(junctions: XcmV4Junctions): NetworkURN | undefined {
  const networkId: NetworkId = {}

  if (junctions.type === 'X1') {
    return extractV4X1GlobalConsensus(junctions, networkId)
  }

  return _networkIdFrom(junctions, networkId)
}

function networkIdFromV3(junctions: XcmV3Junctions): NetworkURN | undefined {
  if (junctions.type === 'Here') {
    return undefined
  }

  const networkId: NetworkId = {}

  if (junctions.type === 'X1') {
    return extractV3X1GlobalConsensus(junctions, networkId)
  }

  return _networkIdFrom(junctions, networkId)
}

// eslint-disable-next-line complexity
export function getParaIdFromJunctions(
  junctions: XcmV2MultilocationJunctions | XcmV3Junctions | XcmV4Junctions,
): string | undefined {
  if (junctions.type === 'Here') {
    return undefined
  }

  if (junctions.type === 'X1') {
    if (isX1V3Junctions(junctions) || isX1V2Junctions(junctions)) {
      return junctions.asX1.isParachain ? junctions.asX1.asParachain.toString() : undefined
    } else {
      for (const j of junctions[`as${junctions.type}`]) {
        if (j.isParachain) {
          return j.asParachain.toString()
        }
      }
    }
    return undefined
  }

  for (const j of junctions[`as${junctions.type}`]) {
    if (j.isParachain) {
      return j.asParachain.toString()
    }
  }
  return undefined
}

export function getParaIdFromMultiLocation(
  loc: XcmV2MultiLocation | StagingXcmV3MultiLocation | XcmV4Location,
): string | undefined {
  const junctions = loc.interior
  if (junctions.type === 'Here') {
    if (loc.parents?.toNumber() === 1) {
      return '0'
    }
    return undefined
  }

  return getParaIdFromJunctions(junctions)
}

export function networkIdFromInteriorLocation(junctions: VersionedInteriorLocation): NetworkURN | undefined {
  if (junctions.isV2) {
    return undefined
  }

  if (junctions.isV3) {
    return networkIdFromV3(junctions.asV3)
  }

  if (junctions.isV4) {
    return networkIdFromV4(junctions.asV4)
  }
  return undefined
}

// eslint-disable-next-line complexity
export function networkIdFromMultiLocation(
  loc: XcmV2MultiLocation | StagingXcmV3MultiLocation | XcmV4Location,
  currentNetworkId: NetworkURN,
): NetworkURN | undefined {
  const { parents, interior: junctions } = loc

  if (parents.toNumber() <= 1) {
    // is within current consensus system
    const paraId = getParaIdFromMultiLocation(loc)

    if (paraId !== undefined) {
      return createNetworkId(currentNetworkId, paraId)
    }
  } else if (parents.toNumber() > 1) {
    // is in other consensus system
    if (junctions.type === 'X1') {
      if (isX1V2Junctions(junctions)) {
        return undefined
      }

      if (isX1V3Junctions(junctions)) {
        return networkIdFromV3(junctions)
      }

      if (isX1V4Junctions(junctions)) {
        return networkIdFromV4(junctions)
      }
    } else if (!isXnV2Junctions(junctions)) {
      return _networkIdFrom(junctions, {})
    }
  }

  return undefined
}

export function networkIdFromVersionedMultiLocation(
  loc: XcmVersionedLocation,
  currentNetworkId: NetworkURN,
): NetworkURN | undefined {
  switch (loc.type) {
    case 'V2':
    case 'V3':
      return networkIdFromMultiLocation(loc[`as${loc.type}`], currentNetworkId)
    case 'V4':
      return networkIdFromMultiLocation(loc.asV4, currentNetworkId)
    default:
      return undefined
  }
}

export function matchProgramByTopic({ instructions }: Program, topicId: HexString): boolean {
  switch (instructions.type) {
    case 'V2':
      throw new Error('Not able to match by topic for XCM V2 program.')
    case 'V3':
    case 'V4':
      for (const instruction of instructions.value) {
        if (instruction === 'SetTopic') {
          return instruction.value.asHex() === topicId
        }
      }
      return false
    default:
      throw new Error('XCM version not supported')
  }
}

export function matchEvent(event: BlockEvent, module: string | string[], name: string | string[]) {
  return (
    (Array.isArray(module) ? module.includes(event.module) : module === event.module) &&
    (Array.isArray(name) ? name.includes(event.name) : name === event.name)
  )
}

export function matchExtrinsic(extrinsic: Extrinsic, module: string, method: string | string[]): boolean {
  return module === extrinsic.module && Array.isArray(method)
    ? method.includes(extrinsic.method)
    : method === extrinsic.method
}

function createTrappedAssetsFromMultiAssets(
  version: number,
  assets: XcmV2MultiassetMultiAssets | XcmV3MultiassetMultiAssets,
): TrappedAsset[] {
  return assets.map((a) => ({
    version,
    id: {
      type: a.id.type,
      value: a.id.isConcrete ? a.id.asConcrete.toHuman() : a.id.asAbstract.toHex(),
    },
    fungible: a.fun.isFungible,
    amount: a.fun.isFungible ? a.fun.asFungible.toPrimitive() : 1,
    assetInstance: a.fun.isNonFungible ? a.fun.asNonFungible.toHuman() : undefined,
  }))
}

function createTrappedAssetsFromAssets(version: number, assets: XcmV4AssetAssets): TrappedAsset[] {
  return assets.map((a) => ({
    version,
    id: {
      type: 'Concrete',
      value: a.id.toHuman(),
    },
    fungible: a.fun.isFungible,
    amount: a.fun.isFungible ? a.fun.asFungible.toPrimitive() : 1,
    assetInstance: a.fun.isNonFungible ? a.fun.asNonFungible.toHuman() : undefined,
  }))
}

function mapVersionedAssets(assets: XcmVersionedAssets): TrappedAsset[] {
  switch (assets.type) {
    case 'V2':
    case 'V3':
      return createTrappedAssetsFromMultiAssets(2, assets[`as${assets.type}`])
    case 'V4':
      return createTrappedAssetsFromAssets(4, assets.asV4)
    default:
      throw new Error('XCM version not supported')
  }
}

export function mapAssetsTrapped(assetsTrappedEvent?: BlockEvent): AssetsTrapped | undefined {
  if (assetsTrappedEvent === undefined) {
    return undefined
  }
  console.log(assetsTrappedEvent.value)
  const [hash_, _, assets] = assetsTrappedEvent.value as [hash_: HexString, _origin: any, assets: any]
  return {
    event: {
      eventId: assetsTrappedEvent.blockPosition,
      blockNumber: assetsTrappedEvent.blockNumber,
      blockHash: assetsTrappedEvent.blockHash as HexString,
      section: assetsTrappedEvent.module,
      method: assetsTrappedEvent.name,
    },
    assets: mapVersionedAssets(assets),
    hash: hash_,
  }
}
