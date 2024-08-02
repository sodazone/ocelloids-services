import { U8aFixed, u8 } from '@polkadot/types-codec'
import { Registry } from '@polkadot/types-codec/types'
import type {
  StagingXcmV3MultiLocation,
  XcmV2Junction,
  XcmV2MultiLocation,
  XcmV2MultilocationJunctions,
  XcmV3Junction,
  XcmV3Junctions,
} from '@polkadot/types/lookup'
import { isInstanceOf } from '@polkadot/util'

import { createNetworkId, getRelayId } from '@/services/config.js'
import { NetworkURN } from '@/services/types.js'
import { safeDestr } from 'destr'
import { XcmV4Junction, XcmV4Junctions, XcmV4Location } from '../xcm/ops/xcm-types.js'
import { mappers } from './mappers.js'
import { AssetIdData, ParsedAsset, XcmVersions } from './types.js'

function isV3GeneralKey(obj: any): obj is {
  data: U8aFixed
  length: u8
} {
  return obj.data !== undefined && isInstanceOf(obj.length, u8)
}

function mapGeneralKey(junction: XcmV2Junction | XcmV3Junction | XcmV4Junction): AssetIdData {
  const genKey = junction.asGeneralKey
  if (isV3GeneralKey(genKey)) {
    return {
      data: genKey.data.toU8a(),
      length: genKey.length.toNumber(),
    }
  }

  return {
    data: genKey.toU8a(),
    length: genKey.length,
  }
}

function parseLocalX1Junction(
  referenceNetwork: NetworkURN,
  junction: XcmV2Junction | XcmV3Junction | XcmV4Junction,
): ParsedAsset | null {
  if (junction.isPalletInstance) {
    // assuming that only valid case is balances pallet
    // TODO: resolve and match pallet instance in mapping
    return {
      network: referenceNetwork,
      assetId: { type: 'string', value: 'native' },
    }
  }
  if (junction.isGeneralKey) {
    return {
      network: referenceNetwork,
      assetId: { type: 'data', value: [mapGeneralKey(junction)] },
    }
  }
  return null
}

function parseLocalAsset(
  referenceNetwork: NetworkURN,
  junctions: XcmV2MultilocationJunctions | XcmV3Junctions | XcmV4Junctions,
): ParsedAsset | null {
  if (junctions.type === 'Here') {
    return {
      network: referenceNetwork,
      assetId: { type: 'string', value: 'native' },
    }
  }
  if (junctions.type === 'X1') {
    const junction = junctions.asX1
    if (Array.isArray(junction)) {
      for (const j of junction) {
        return parseLocalX1Junction(referenceNetwork, j)
      }
    } else {
      return parseLocalX1Junction(referenceNetwork, junction)
    }
  } else {
    let pallet: number | undefined
    const assetIdData: AssetIdData[] = []
    let accountId20: string | undefined

    for (const junction of junctions[`as${junctions.type}`]) {
      if (junction.isPalletInstance) {
        pallet = junction.asPalletInstance.toNumber()
      } else if (junction.isGeneralIndex) {
        const genIndex = junction.asGeneralIndex
        const data = genIndex.unwrap().toU8a()
        assetIdData.push({
          data,
          length: genIndex.encodedLength,
        })
      } else if (junction.isGeneralKey) {
        assetIdData.push(mapGeneralKey(junction))
      } else if (junction.isAccountKey20) {
        accountId20 = junction.asAccountKey20.toString()
      }
    }

    return mapParsedAsset({
      network: referenceNetwork,
      pallet,
      assetIdData,
      accountId20,
    })
  }

  return null
}

function parseCrossChainAsset(
  referenceNetwork: NetworkURN,
  junctions: XcmV2MultilocationJunctions | XcmV3Junctions | XcmV4Junctions,
): ParsedAsset | null {
  if (junctions.type === 'Here') {
    return {
      network: getRelayId(referenceNetwork),
      assetId: { type: 'string', value: 'native' },
    }
  }
  if (junctions.type === 'X1') {
    const junction = junctions.asX1
    if (Array.isArray(junction)) {
      if (junction[0].isParachain) {
        return {
          network: createNetworkId(referenceNetwork, junction[0].asParachain.toString()),
          assetId: { type: 'string', value: 'native' },
        }
      }
    } else if (junction.isParachain) {
      return {
        network: createNetworkId(referenceNetwork, junction.asParachain.toString()),
        assetId: { type: 'string', value: 'native' },
      }
    }
  } else {
    let network: NetworkURN | undefined
    let pallet: number | undefined
    const assetIdData: AssetIdData[] = []
    let accountId20: string | undefined

    for (const junction of junctions[`as${junctions.type}`]) {
      if (junction.isParachain) {
        network = createNetworkId(referenceNetwork, junction.asParachain.toString())
      } else if (junction.isPalletInstance) {
        pallet = junction.asPalletInstance.toNumber()
      } else if (junction.isGeneralIndex) {
        const genIndex = junction.asGeneralIndex
        const data = genIndex.unwrap().toU8a()
        assetIdData.push({
          data,
          length: genIndex.encodedLength,
        })
      } else if (junction.isGeneralKey) {
        assetIdData.push(mapGeneralKey(junction))
      } else if (junction.isAccountKey20) {
        accountId20 = junction.asAccountKey20.toString()
      }
    }

    if (!network) {
      return null
    }

    return mapParsedAsset({
      network,
      pallet,
      assetIdData,
      accountId20,
    })
  }

  return null
}

function mapParsedAsset({
  network,
  pallet,
  assetIdData,
  accountId20,
}: {
  network: NetworkURN
  pallet: number | undefined
  assetIdData: AssetIdData[]
  accountId20: string | undefined
}): ParsedAsset | null {
  if (pallet) {
    // assuming that only valid case is balances pallet
    // TODO: resolve and match pallet instance in mapping
    if (!accountId20 && assetIdData.length === 0) {
      return {
        network,
        assetId: { type: 'string', value: 'native' },
      }
    }

    if (assetIdData.length > 0) {
      return {
        network,
        assetId: {
          type: 'data',
          value: assetIdData,
        },
        pallet,
      }
    }
    // TODO: support EVM contract assets
  } else if (assetIdData.length > 0) {
    return {
      network,
      assetId: {
        type: 'data',
        value: assetIdData,
      },
    }
  }
  return null
}

function parseMultiLocation(
  referenceNetwork: NetworkURN,
  location: XcmV2MultiLocation | StagingXcmV3MultiLocation | XcmV4Location,
): ParsedAsset | null {
  const parents = location.parents.toNumber()
  const junctions = location.interior

  if (parents === 0) {
    return parseLocalAsset(referenceNetwork, junctions)
  } else if (parents === 1) {
    return parseCrossChainAsset(referenceNetwork, junctions)
  }
  // cross-consensus not supported yet

  return null
}

export function parseAssetFromJson(
  network: NetworkURN,
  loc: string,
  registry: Registry,
  version?: XcmVersions,
): ParsedAsset | null {
  const cleansedLoc = loc.toLowerCase().replace(/(?<=\d),(?=\d)/g, '')
  if (version === 'v4') {
    const multiLocation = registry.createType(
      'StagingXcmV4Location',
      safeDestr(cleansedLoc),
    ) as unknown as XcmV4Location
    return parseMultiLocation(network, multiLocation)
  }
  if (version === 'v2') {
    const multiLocation = registry.createType('XcmV2MultiLocation', safeDestr(cleansedLoc))
    return parseMultiLocation(network, multiLocation)
  }
  // Try V3 as fallback if no version passed
  const multiLocation = registry.createType('StagingXcmV3MultiLocation', safeDestr(cleansedLoc))
  return parseMultiLocation(network, multiLocation)
}
