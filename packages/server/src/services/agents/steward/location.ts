import { U8aFixed, u8 } from '@polkadot/types-codec'
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
import { XcmV4Junction, XcmV4Junctions, XcmV4Location } from '../xcm/ops/xcm-types.js'
import { mappers } from './mappers.js'
import { GeneralKey } from './types.js'

export type ParsedAsset = {
  network: NetworkURN
  assetId: string | GeneralKey
}

function isV3GeneralKey(obj: any): obj is {
  data: U8aFixed
  length: u8
} {
  return obj.data !== undefined && isInstanceOf(obj.length, u8)
}

function mapGeneralKey(junction: XcmV2Junction | XcmV3Junction | XcmV4Junction) {
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
    // only valid case SHOULD be balances pallet
    // but we should check mapping to be sure
    return {
      network: referenceNetwork,
      assetId: 'native',
    }
  }
  if (junction.isGeneralKey) {
    return {
      network: referenceNetwork,
      assetId: mapGeneralKey(junction),
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
      assetId: 'native',
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
    let index: string | undefined
    let key: GeneralKey | undefined
    let accountId20: string | undefined

    for (const junction of junctions[`as${junctions.type}`]) {
      if (junction.isPalletInstance) {
        pallet = junction.asPalletInstance.toNumber()
      } else if (junction.isGeneralIndex) {
        index = junction.asGeneralIndex.toString()
      } else if (junction.isGeneralKey) {
        key = mapGeneralKey(junction)
      } else if (junction.isAccountKey20) {
        accountId20 = junction.asAccountKey20.toString()
      }
    }

    if (pallet) {
      // assume if there's only pallet instance that it is the balances pallet
      if (!index && !key && !accountId20) {
        return {
          network: referenceNetwork,
          assetId: 'native',
        }
      }

      const palletInstances = mappers[referenceNetwork].mappings.map((m) => m.palletInstance)
      if (palletInstances.includes(pallet) && index !== undefined) {
        return {
          network: referenceNetwork,
          assetId: index,
        }
      }
      if (palletInstances.includes(pallet) && key !== undefined) {
        return {
          network: referenceNetwork,
          assetId: key,
        }
      }
      // TODO: support EVM contract assets
    } else if (key) {
      return {
        network: referenceNetwork,
        assetId: key,
      }
    }
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
      assetId: 'native',
    }
  }
  if (junctions.type === 'X1') {
    const junction = junctions.asX1
    if (Array.isArray(junction)) {
      if (junction[0].isParachain) {
        return {
          network: createNetworkId(referenceNetwork, junction[0].asParachain.toString()),
          assetId: 'native',
        }
      }
    } else if (junction.isParachain) {
      return {
        network: createNetworkId(referenceNetwork, junction.asParachain.toString()),
        assetId: 'native',
      }
    }
  } else {
    let network: NetworkURN | undefined
    let pallet: number | undefined
    let index: string | undefined
    let key: GeneralKey | undefined
    let accountId20: string | undefined

    for (const junction of junctions[`as${junctions.type}`]) {
      if (junction.isParachain) {
        network = createNetworkId(referenceNetwork, junction.asParachain.toString())
      } else if (junction.isPalletInstance) {
        pallet = junction.asPalletInstance.toNumber()
      } else if (junction.isGeneralIndex) {
        index = junction.asGeneralIndex.toString()
      } else if (junction.isGeneralKey) {
        key = mapGeneralKey(junction)
      } else if (junction.isAccountKey20) {
        accountId20 = junction.asAccountKey20.toString()
      }
    }

    if (!network) {
      return null
    }

    if (pallet) {
      // assume if there's only pallet instance that it is the balances pallet
      if (!index && !key && !accountId20) {
        return {
          network,
          assetId: 'native',
        }
      }

      const palletInstances = mappers[network].mappings.map((m) => m.palletInstance)
      if (palletInstances.includes(pallet) && index !== undefined) {
        return {
          network,
          assetId: index,
        }
      }
      if (palletInstances.includes(pallet) && key !== undefined) {
        return {
          network,
          assetId: key,
        }
      }
      // TODO: support EVM contract assets
    } else if (key) {
      return {
        network,
        assetId: key,
      }
    }
  }

  return null
}

export function parseMultiLocation(
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
