import type { U8aFixed } from '@polkadot/types-codec'
import type { H256 } from '@polkadot/types/interfaces/runtime'
import type {
  PolkadotRuntimeParachainsInclusionAggregateMessageOrigin,
  StagingXcmV3MultiLocation,
  XcmV2MultiLocation,
  XcmV2MultiassetMultiAssets,
  XcmV2MultilocationJunctions,
  XcmV3Junction,
  XcmV3Junctions,
  XcmV3MultiassetMultiAssets,
} from '@polkadot/types/lookup'

import { types } from '@sodazone/ocelloids-sdk'

import { GlobalConsensus, createNetworkId, getConsensus, isGlobalConsensus } from '../../../config.js'
import { HexString, SignerData } from '../../../subscriptions/types.js'
import { NetworkURN } from '../../../types.js'
import { AssetsTrapped, TrappedAsset } from '../types.js'
import {
  VersionedInteriorLocation,
  XcmV4AssetAssets,
  XcmV4Junction,
  XcmV4Junctions,
  XcmV4Location,
  XcmVersionedAssets,
  XcmVersionedLocation,
  XcmVersionedXcm,
} from './xcm-types.js'

const BRIDGE_HUB_NETWORK_IDS: Record<GlobalConsensus, NetworkURN | undefined> = {
  polkadot: 'urn:ocn:polkadot:1002',
  kusama: 'urn:ocn:kusama:1002',
  rococo: 'urn:ocn:rococo:1013',
  westend: 'urn:ocn:westend:1002',
  local: 'urn:ocn:local:1002',
  wococo: 'urn:ocn:wococo:1002',
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

function createSignersData(xt: types.ExtrinsicWithId): SignerData | undefined {
  try {
    if (xt.isSigned) {
      // Signer could be Address or AccountId
      const accountId = xt.signer.value ?? xt.signer
      return {
        signer: {
          id: accountId.toPrimitive(),
          publicKey: accountId.toHex(),
        },
        extraSigners: xt.extraSigners.map((signer) => ({
          type: signer.type,
          id: signer.address.value.toPrimitive(),
          publicKey: signer.address.value.toHex(),
        })),
      }
    }
  } catch (error) {
    throw new Error(`creating signers data at ${xt.extrinsicId ?? '-1'}`, { cause: error })
  }

  return undefined
}

export function getSendersFromExtrinsic(extrinsic: types.ExtrinsicWithId): SignerData | undefined {
  return createSignersData(extrinsic)
}

export function getSendersFromEvent(event: types.BlockEvent): SignerData | undefined {
  if (event.extrinsic !== undefined) {
    return getSendersFromExtrinsic(event.extrinsic)
  }
  return undefined
}
/**
 * Gets message id from setTopic.
 */
export function getMessageId(program: XcmVersionedXcm): HexString | undefined {
  switch (program.type) {
    // Only XCM V3+ supports topic ID
    case 'V3':
    case 'V4':
      for (const instruction of program[`as${program.type}`]) {
        if (instruction.isSetTopic) {
          return instruction.asSetTopic.toHex()
        }
      }
      return undefined
    default:
      return undefined
  }
}

export function getParaIdFromOrigin(
  origin: PolkadotRuntimeParachainsInclusionAggregateMessageOrigin,
): string | undefined {
  if (origin.isUmp) {
    const umpOrigin = origin.asUmp
    if (umpOrigin.isPara) {
      return umpOrigin.asPara.toString()
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

export function matchProgramByTopic(message: XcmVersionedXcm, topicId: U8aFixed): boolean {
  switch (message.type) {
    case 'V2':
      throw new Error('Not able to match by topic for XCM V2 program.')
    case 'V3':
    case 'V4':
      for (const instruction of message[`as${message.type}`]) {
        if (instruction.isSetTopic) {
          return instruction.asSetTopic.eq(topicId)
        }
      }
      return false
    default:
      throw new Error('XCM version not supported')
  }
}

export function matchEvent(event: types.BlockEvent, section: string | string[], method: string | string[]) {
  return (
    (Array.isArray(section) ? section.includes(event.section) : section === event.section) &&
    (Array.isArray(method) ? method.includes(event.method) : method === event.method)
  )
}

export function matchExtrinsic(
  extrinsic: types.ExtrinsicWithId,
  section: string,
  method: string | string[],
): boolean {
  return section === extrinsic.method.section && Array.isArray(method)
    ? method.includes(extrinsic.method.method)
    : method === extrinsic.method.method
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

export function mapAssetsTrapped(assetsTrappedEvent?: types.BlockEvent): AssetsTrapped | undefined {
  if (assetsTrappedEvent === undefined) {
    return undefined
  }
  const [hash_, _, assets] = assetsTrappedEvent.data as unknown as [
    hash_: H256,
    _origin: any,
    assets: XcmVersionedAssets,
  ]
  return {
    event: {
      eventId: assetsTrappedEvent.eventId,
      blockNumber: assetsTrappedEvent.blockNumber.toPrimitive(),
      blockHash: assetsTrappedEvent.blockHash.toHex(),
      section: assetsTrappedEvent.section,
      method: assetsTrappedEvent.method,
    },
    assets: mapVersionedAssets(assets),
    hash: hash_.toHex(),
  }
}
