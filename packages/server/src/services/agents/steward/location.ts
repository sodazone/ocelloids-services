import type { StagingXcmV3MultiLocation, XcmV3Junctions } from '@polkadot/types/lookup'

import { NetworkURN } from 'lib.js'
import { createNetworkId, getRelayId } from 'services/config.js'
import { mappers } from './mappers.js'
import { GeneralKey } from './types.js'

type ParsedAsset = {
  network: NetworkURN
  assetId: string | GeneralKey
}

function parseLocalAsset(referenceNetwork: NetworkURN, junctions: XcmV3Junctions): ParsedAsset | undefined {
  if (junctions.type === 'Here') {
    return {
      network: referenceNetwork,
      assetId: 'native#0',
    }
  }
  if (junctions.type === 'X1') {
    const junction = junctions.asX1
    if (junction.isPalletInstance) {
      // only valid case SHOULD be balances pallet
      // but we should check mapping to be sure
      return {
        network: referenceNetwork,
        assetId: 'native#0',
      }
    }
    if (junction.isGeneralKey) {
      // XXX how to resolve general key???
      return {
        network: referenceNetwork,
        assetId: junction.asGeneralKey,
      }
    }
  }
}

function parseCrossChainAsset(
  referenceNetwork: NetworkURN,
  junctions: XcmV3Junctions,
): ParsedAsset | undefined {
  if (junctions.type === 'Here') {
    return {
      network: getRelayId(referenceNetwork),
      assetId: 'native#0',
    }
  }
  if (junctions.type === 'X1') {
    const junction = junctions.asX1
    if (junction.isParachain) {
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

    for (const junction of junctions[`as${junctions.type}`]) {
      if (junction.isParachain) {
        network = createNetworkId(referenceNetwork, junction.asParachain.toString())
      } else if (junction.isPalletInstance) {
        pallet = junction.asPalletInstance.toNumber()
      } else if (junction.isGeneralIndex) {
        index = junction.asGeneralIndex.toString()
      } else if (junction.isGeneralKey) {
        key = junction.asGeneralKey
      }
    }

    if (!network) {
      return undefined
    }

    if (pallet) {
      // assume if there's only pallet instance that it is the balances pallet
      if (!index && !key) {
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
    } else if (key) {
      return {
        network,
        assetId: key,
      }
    }
  }
}

export function parseMultiLocation(
  referenceNetwork: NetworkURN,
  location: StagingXcmV3MultiLocation,
): ParsedAsset | undefined {
  const parents = location.parents.toNumber()
  const junctions = location.interior

  if (parents === 0) {
    return parseLocalAsset(referenceNetwork, junctions)
  } else if (parents === 1) {
    return parseCrossChainAsset(referenceNetwork, junctions)
  }
  // cross-consensus not supported yet

  return undefined
}
