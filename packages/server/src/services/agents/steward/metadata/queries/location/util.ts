import { HexString } from 'polkadot-api'
import { fromHex, mergeUint8 } from 'polkadot-api/utils'
import { createNetworkId, getConsensus, getRelayId } from '@/services/config.js'
import { AnyJson, NetworkURN } from '@/services/types.js'
import { ParsedAsset } from '../../../types.js'

type DecodedObject = {
  type: string
  value: AnyJson
}

type MultilocationInterior =
  | {
      type: 'here'
    }
  | {
      type: 'x1'
      value: DecodedObject[] | DecodedObject
    }
  | {
      type: 'x2' | 'x3'
      value: DecodedObject[]
    }

type Multilocation = {
  parents: number
  interior: MultilocationInterior
}

type VersionedMultilocation = {
  type: 'v2' | 'v3' | 'v4' | 'v5'
  value: Multilocation
}

function isV3V4GeneralKey(obj: any): obj is {
  data: string
  length: number
} {
  return obj.data !== undefined && obj.length !== undefined
}

function isVersionedMultilocation(obj: any): obj is VersionedMultilocation {
  return obj.type && typeof obj.type === 'string' && obj.type.startsWith('v')
}

function mapGeneralKey(key: AnyJson): Uint8Array {
  if (isV3V4GeneralKey(key)) {
    return fromHex(key.data).slice(0, key.length)
  }

  // need to be sliced???
  // before: genKey.toU8a(true), genKey.toU8a(true).length
  return fromHex(key as HexString)
}

function parseLocalX1Junction(referenceNetwork: NetworkURN, junction: DecodedObject): ParsedAsset | null {
  if (junction.type === 'palletinstance') {
    // assuming that only valid case is balances pallet
    // TODO: resolve and match pallet instance in mapping
    return {
      network: referenceNetwork,
      assetId: { type: 'string', value: 'native' },
    }
  }
  if (junction.type === 'generalkey') {
    return {
      network: referenceNetwork,
      assetId: { type: 'data', value: mapGeneralKey(junction.value) },
    }
  }
  if (junction.type === 'generalindex') {
    if (junction.value === undefined || junction.value === null) {
      return null
    }
    return {
      network: referenceNetwork,
      assetId: { type: 'string', value: junction.value.toString() },
    }
  }
  if (junction.type === 'accountkey20') {
    return {
      network: referenceNetwork,
      assetId: { type: 'contract', value: (junction.value as { key: string }).key as string },
    }
  }
  return null
}

function parseLocalAsset(referenceNetwork: NetworkURN, junctions: MultilocationInterior): ParsedAsset | null {
  if (junctions.type === 'here') {
    return {
      network: referenceNetwork,
      assetId: { type: 'string', value: 'native' },
    }
  }
  if (junctions.type === 'x1') {
    const junction = junctions.value
    if (Array.isArray(junction)) {
      return parseLocalX1Junction(referenceNetwork, junction[0])
    } else {
      return parseLocalX1Junction(referenceNetwork, junction)
    }
  } else {
    let pallet: number | undefined
    let assetIdData: Uint8Array = new Uint8Array()
    let accountId20: string | undefined
    let assetIndex: string | undefined

    for (const junction of junctions.value) {
      if (junction.type === 'palletinstance') {
        pallet = junction.value as number
      } else if (junction.type === 'generalindex') {
        const genIndex = junction.value
        assetIndex = genIndex as string
        // const data = genIndex.unwrap().toU8a()
        // assetIdData.push({
        //   data,
        //   length: genIndex.encodedLength,
        // })
      } else if (junction.type === 'generalkey') {
        assetIdData = mergeUint8([assetIdData, mapGeneralKey(junction.value)])
      } else if (junction.type === 'accountkey20') {
        accountId20 = (junction.value as { key: string }).key as string
      }
    }

    return mapParsedAsset({
      network: referenceNetwork,
      pallet,
      assetIdData,
      accountId20,
      assetIndex,
    })
  }
}

function parseCrossChainAsset(
  referenceNetwork: NetworkURN,
  junctions: MultilocationInterior,
): ParsedAsset | null {
  if (junctions.type === 'here') {
    return {
      network: getRelayId(referenceNetwork),
      assetId: { type: 'string', value: 'native' },
    }
  }
  if (junctions.type === 'x1') {
    const junction = Array.isArray(junctions.value) ? junctions.value[0] : junctions.value
    if (junction.type === 'parachain') {
      return {
        network: createNetworkId(referenceNetwork, junction.value as string),
        assetId: { type: 'string', value: 'native' },
      }
    }
    if (junction.type === 'globalconsensus') {
      const network = parseGlobalConsensusNetwork(junction)

      if (network && getConsensus(network) !== getConsensus(referenceNetwork)) {
        return {
          network,
          assetId: { type: 'string', value: 'native' },
        }
      }
    }

    return null
  }

  let network: NetworkURN | undefined
  let pallet: number | undefined
  let assetIdData: Uint8Array = new Uint8Array()
  let accountId20: string | undefined
  let assetIndex: string | undefined

  for (const junction of junctions.value) {
    if (junction.type === 'parachain') {
      const paraId = (junction.value as string | number).toString()

      if (paraId !== '0') {
        network = createNetworkId(referenceNetwork, paraId)
      }
    } else if (junction.type === 'palletinstance') {
      pallet = junction.value as number
    } else if (junction.type === 'generalindex') {
      const genIndex = junction.value
      assetIndex = genIndex as string
      // const data = genIndex.unwrap().toU8a()
      // assetIdData.push({
      //   data,
      //   length: genIndex.encodedLength,
      // })
    } else if (junction.type === 'generalkey') {
      assetIdData = mergeUint8([assetIdData, mapGeneralKey(junction.value)])
    } else if (junction.type === 'accountkey20') {
      accountId20 = (junction.value as { key: string }).key as string
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
    assetIndex,
  })
}

function parseGlobalConsensusNetwork(junction: DecodedObject): NetworkURN | null {
  if (junction.type === 'globalconsensus') {
    if (junction.value === null || junction.value === undefined || Array.isArray(junction.value)) {
      return null
    } else if (typeof junction.value === 'string') {
      const network = (junction.value as string).toLowerCase()
      return `urn:ocn:${network}:0`
    } else if (
      typeof junction.value === 'object' &&
      'type' in junction.value &&
      junction.value.type === 'ethereum'
    ) {
      const chainId =
        typeof junction.value.value === 'object' &&
        junction.value.value !== null &&
        !Array.isArray(junction.value.value)
          ? junction.value.value.chain_id
          : 1
      return `urn:ocn:ethereum:${chainId}`
    } else if (typeof junction.value === 'object' && 'type' in junction.value) {
      const network = junction.value.type

      return `urn:ocn:${network}:0`
    }
  }
  return null
}

function parseCrossConsensusAsset(junctions: MultilocationInterior): ParsedAsset | null {
  // not possible
  if (junctions.type === 'here') {
    return null
  }
  // relay/solo chains native asset
  if (junctions.type === 'x1') {
    const junction = junctions.value
    let network: NetworkURN | null = null
    if (Array.isArray(junction)) {
      network = parseGlobalConsensusNetwork(junction[0])
    } else if (junction.type === 'globalconsensus') {
      network = parseGlobalConsensusNetwork(junction)
    }
    if (network === null) {
      return null
    }
    return {
      network,
      assetId: { type: 'string', value: 'native' },
    }
  }

  // External network tokens
  if (junctions.type === 'x2') {
    const interiorJunctions = junctions.value
    const network = parseGlobalConsensusNetwork(interiorJunctions[0])
    const contract =
      interiorJunctions[1].type === 'accountkey20'
        ? (interiorJunctions[1].value! as { key: string }).key
        : null
    if (network !== null && contract !== null) {
      return {
        network,
        assetId: { type: 'contract', value: contract },
      }
    }
  }
  return null
}

function mapParsedAsset({
  network,
  assetIdData,
  accountId20,
  assetIndex,
}: {
  network: NetworkURN
  pallet?: number
  assetIdData: Uint8Array
  accountId20?: string
  assetIndex?: string
}): ParsedAsset | null {
  if (!accountId20 && assetIdData.length === 0 && !assetIndex) {
    // assuming that only valid case is balances pallet
    // TODO: resolve and match pallet instance in mapping
    return {
      network,
      assetId: { type: 'string', value: 'native' },
    }
  }

  // // TODO: handle Pendulum assets case
  // if (assetIndex && assetIdData > 0) {
  // }

  if (assetIndex) {
    return {
      network,
      assetId: { type: 'string', value: assetIndex },
    }
  }

  if (assetIdData.length > 0) {
    return {
      network,
      assetId: {
        type: 'data',
        value: assetIdData,
      },
    }
  }

  // TODO: support EVM contract assets
  if (accountId20 !== undefined) {
    return {
      network,
      assetId: {
        type: 'contract',
        value: accountId20,
      },
    }
  }

  return null
}

function parseAssetFromMultilocation(network: NetworkURN, location: Multilocation) {
  const parents = location.parents
  const junctions = location.interior

  if (parents === 0) {
    return parseLocalAsset(network, junctions)
  } else if (parents === 1) {
    return parseCrossChainAsset(network, junctions)
  } else if (parents === 2) {
    return parseCrossConsensusAsset(junctions)
  }
  return null
}

export function parseAssetFromJson(network: NetworkURN, loc: string): ParsedAsset | null {
  const asJson = JSON.parse(loc.toLowerCase().replace(/(?<=\d),(?=\d)/g, ''))
  if (isVersionedMultilocation(asJson)) {
    return parseAssetFromMultilocation(network, asJson.value)
  } else {
    return parseAssetFromMultilocation(network, asJson as Multilocation)
  }
}
