import type { StagingXcmV3MultiLocation, XcmV3Junction, XcmV3Junctions } from '@polkadot/types/lookup'

import { createNetworkId, getRelayId } from '../../config.js'
import { NetworkURN } from '../../types.js'
import { XcmV4Junction, XcmV4Junctions, XcmV4Location } from '../xcm/ops/xcm-types.js'
import { mappers } from './mappers.js'
import { GeneralKey } from './types.js'

export type ParsedAsset = {
  network: NetworkURN
  assetId: string | GeneralKey
}

function localAssetJunction(
  referenceNetwork: NetworkURN,
  junction: XcmV3Junction | XcmV4Junction,
): ParsedAsset | null {
  if (junction.isPalletInstance) {
    // only valid case SHOULD be balances pallet
    // but we should check mapping to be sure
    return {
      network: referenceNetwork,
      assetId: 'native#0',
    }
  }
  if (junction.isGeneralKey) {
    return {
      network: referenceNetwork,
      assetId: junction.asGeneralKey,
    }
  }
  return null
}

function parseLocalAsset(
  referenceNetwork: NetworkURN,
  junctions: XcmV3Junctions | XcmV4Junctions,
): ParsedAsset | null {
  if (junctions.type === 'Here') {
    return {
      network: referenceNetwork,
      assetId: 'native#0',
    }
  }
  if (junctions.type === 'X1') {
    const junction = junctions.asX1
    if (Array.isArray(junction)) {
      for (const j of junction) {
        return localAssetJunction(referenceNetwork, j)
      }
    } else {
      return localAssetJunction(referenceNetwork, junction)
    }
  }

  return null
}

function parseCrossChainAsset(
  referenceNetwork: NetworkURN,
  junctions: XcmV3Junctions | XcmV4Junctions,
): ParsedAsset | null {
  if (junctions.type === 'Here') {
    return {
      network: getRelayId(referenceNetwork),
      assetId: 'native#0',
    }
  }
  if (junctions.type === 'X1') {
    const junction = junctions.asX1
    if (Array.isArray(junction)) {
      if (junction[0].isParachain) {
        return {
          network: createNetworkId(referenceNetwork, junction[0].asParachain.toString()),
          assetId: 'native#0',
        }
      }
    } else if (junction.isParachain) {
      return {
        network: createNetworkId(referenceNetwork, junction.asParachain.toString()),
        assetId: 'native#0',
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
        key = junction.asGeneralKey
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
          assetId: 'native#0',
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
  location: StagingXcmV3MultiLocation | XcmV4Location,
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
