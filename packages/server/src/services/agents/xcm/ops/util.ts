import { getSs58AddressInfo } from 'polkadot-api'

import { createNetworkId } from '@/services/config.js'
import { BlockEvent, BlockExtrinsic, Extrinsic } from '@/services/networking/index.js'
import { HexString, SignerData } from '@/services/subscriptions/types.js'
import { NetworkURN } from '@/services/types.js'

import { toHex } from 'polkadot-api/utils'
import { asSerializable } from '../../base/util.js'
import { AssetsTrapped, TrappedAsset } from '../types.js'
import { Program } from './xcm-format.js'

function createSignersData(xt: BlockExtrinsic): SignerData | undefined {
  try {
    if (xt.signed) {
      // Signer could be Address or AccountId
      const accountId = typeof xt.address === 'string' ? xt.address : xt.address.value
      const info = getSs58AddressInfo(accountId)
      if (!info.isValid) {
        throw new Error(`invalid address format ${accountId}`)
      }
      return {
        signer: {
          id: accountId,
          publicKey: toHex(info.publicKey) as HexString,
        },
        // TODO: from flat nested calls
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

type NetworkId = {
  consensus?: string
  chainId?: string
}

function extractConsensusAndId(j: any, n: NetworkId) {
  const network = j.value
  if (network.type === 'Ethereum') {
    n.consensus = network.type.toLowerCase()
    n.chainId = network.value.chainId.toString()
  } else if (network.type !== 'ByFork' && network.type !== 'ByGenesis') {
    n.consensus = network.type.toLowerCase()
  }
}

function extractV4X1GlobalConsensus(junctions: any, n: NetworkId): NetworkURN | undefined {
  const j = junctions.value
  if (j.type === 'GlobalConsensus') {
    extractConsensusAndId(j, n)
    if (n.consensus !== undefined) {
      return createNetworkId(n.consensus, n.chainId ?? '0')
    }
  }
  return undefined
}

function _networkIdFrom(junctions: any, networkId: NetworkId) {
  if (junctions.type === 'X1' || junctions.type === 'Here') {
    return undefined
  }

  for (const j of junctions.value) {
    if (j.value) {
      extractConsensusAndId(j, networkId)
    }

    if (j.type === 'Parachain') {
      networkId.chainId = j.asParachain.toString()
    }
  }

  if (networkId.consensus !== undefined) {
    return createNetworkId(networkId.consensus, networkId.chainId ?? '0')
  }

  return undefined
}

function networkIdFromV4(junctions: any): NetworkURN | undefined {
  const networkId: NetworkId = {}

  if (junctions.type === 'X1') {
    return extractV4X1GlobalConsensus(junctions, networkId)
  }

  return _networkIdFrom(junctions, networkId)
}

// eslint-disable-next-line complexity
export function getParaIdFromJunctions(junctions: { type: string; value: any | any[] }): string | undefined {
  if (junctions.type === 'Here') {
    return undefined
  }

  if (Array.isArray(junctions.value)) {
    for (const j of junctions.value) {
      if (j.type === 'Parachain') {
        return j.value.toString()
      }
    }
  } else {
    const j = junctions.value
    if (j.type === 'Parachain') {
      return j.value.toString()
    }
  }

  return undefined
}

export function getParaIdFromMultiLocation(loc: MultiLocation): string | undefined {
  if (loc.interior.type === 'Here') {
    if (loc.parents === 1) {
      return '0'
    }
    return undefined
  }

  return getParaIdFromJunctions(loc.interior)
}

export function networkIdFromInteriorLocation(junctions: {
  type: string
  value: { type: string; value: any }
}): NetworkURN | undefined {
  return networkIdFromV4(junctions)
}

type MultiLocation = { parents: number; interior: any }

export function networkIdFromMultiLocation(
  loc: MultiLocation,
  currentNetworkId: NetworkURN,
): NetworkURN | undefined {
  const { parents, interior } = loc
  if (parents <= 1) {
    // is within current consensus system
    const paraId = getParaIdFromMultiLocation(loc)

    if (paraId !== undefined) {
      return createNetworkId(currentNetworkId, paraId)
    }
  } else if (parents > 1) {
    // is in other consensus system
    if (interior.type === 'X1') {
      return networkIdFromV4(interior)
    } else {
      return _networkIdFrom(interior, {})
    }
  }

  return undefined
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

function createTrappedAssetsFromMultiAssets(version: number, assets: any[]): TrappedAsset[] {
  return assets.map((a) => {
    const fungible = a.fun.type === 'Fungible'
    return {
      version,
      id: {
        type: a.id.type,
        value: asSerializable(a.id.value),
      },
      fungible,
      amount: fungible ? a.fun.value : 1,
      assetInstance: a.fun.type === 'NonFungible' ? asSerializable(a.fun.value) : undefined,
    }
  })
}

function createTrappedAssetsFromAssets(version: number, assets: any[]): TrappedAsset[] {
  return assets.map((a) => {
    const fungible = a.fun.type === 'Fungible'
    return {
      version,
      id: {
        type: 'Concrete',
        value: asSerializable(a.id.value),
      },
      fungible,
      amount: fungible ? a.fun.value : 1,
      assetInstance: a.fun.type === 'NonFungible' ? asSerializable(a.fun.value) : undefined,
    }
  })
}

function mapVersionedAssets(assets: any): TrappedAsset[] {
  switch (assets.type) {
    case 'V2':
    case 'V3':
      return createTrappedAssetsFromMultiAssets(2, assets.value)
    case 'V4':
      return createTrappedAssetsFromAssets(4, assets.value)
    default:
      throw new Error('XCM version not supported')
  }
}

export function mapAssetsTrapped(assetsTrappedEvent?: BlockEvent): AssetsTrapped | undefined {
  if (assetsTrappedEvent === undefined) {
    return undefined
  }
  const { hash, assets } = assetsTrappedEvent.value
  return {
    event: {
      eventId: assetsTrappedEvent.blockPosition,
      blockNumber: assetsTrappedEvent.blockNumber,
      blockHash: assetsTrappedEvent.blockHash as HexString,
      section: assetsTrappedEvent.module,
      method: assetsTrappedEvent.name,
    },
    assets: mapVersionedAssets(assets),
    hash: hash.asHex(),
  }
}
