import type {
  XcmVersionedMultiLocation,
  XcmV3MultiLocation,
  XcmV2MultiLocation,
  XcmV3Junctions,
  XcmVersionedMultiAssets,
  XcmV2MultiassetMultiAssets,
  XcmV3MultiassetMultiAssets,
  XcmV2MultilocationJunctions,
  XcmV3Junction,
  PolkadotRuntimeParachainsInclusionAggregateMessageOrigin,
} from '@polkadot/types/lookup';
import type { U8aFixed } from '@polkadot/types-codec';
import type { H256 } from '@polkadot/types/interfaces/runtime';

import { types } from '@sodazone/ocelloids-sdk';

import { AssetsTrapped, HexString, SignerData, TrappedAsset } from '../types.js';
import {
  XcmVersionedXcm,
  XcmVersionedLocation,
  XcmVersionedAssets,
  XcmV4Location,
  XcmV4AssetAssets,
  XcmV4Junctions,
  XcmV4Junction,
} from './xcm-types.js';
import { createNetworkId } from '../../config.js';
import { NetworkURN } from '../../types.js';

function createSignersData(xt: types.ExtrinsicWithId): SignerData | undefined {
  try {
    if (xt.isSigned) {
      // Signer could be Address or AccountId
      const accountId = xt.signer.value ?? xt.signer;
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
      };
    }
  } catch (error) {
    throw new Error(`creating signers data at ${xt.extrinsicId} ${xt.signer.toRawType()}`, { cause: error });
  }

  return undefined;
}

export function getSendersFromExtrinsic(extrinsic: types.ExtrinsicWithId): SignerData | undefined {
  return createSignersData(extrinsic);
}

export function getSendersFromEvent(event: types.BlockEvent): SignerData | undefined {
  if (event.extrinsic !== undefined) {
    return getSendersFromExtrinsic(event.extrinsic);
  }
  return undefined;
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
          return instruction.asSetTopic.toHex();
        }
      }
      return undefined;
    default:
      return undefined;
  }
}

export function getParaIdFromOrigin(
  origin: PolkadotRuntimeParachainsInclusionAggregateMessageOrigin
): string | undefined {
  if (origin.isUmp) {
    const umpOrigin = origin.asUmp;
    if (umpOrigin.isPara) {
      return umpOrigin.asPara.toString();
    }
  }

  return undefined;
}

export function isV2Junctions(object: any): object is XcmV2MultilocationJunctions {
  return (
    object.asX1 !== undefined &&
    object.asX1.isGlobalConsensus === undefined &&
    object.asX1.asGlobalConsensus === undefined
  );
}

export function isV4Junctions(object: any): object is XcmV4Junctions {
  return object.asX1 !== undefined && typeof object.asX1[Symbol.iterator] === 'function';
}

export function isV3Junctions(object: any): object is XcmV3Junctions {
  return object.asX1 !== undefined && object.asX1.isGlobalConsensus !== undefined && typeof object.asX1 === 'object';
}

export function isV4Location(object: any): object is XcmV4Location {
  return (
    object.parent !== undefined &&
    object.interior !== undefined &&
    object.interior.asX1 !== undefined &&
    typeof object.interior.asX1[Symbol.iterator] === 'function'
  );
}

type NetworkId = {
  consensus?: string;
  chainId?: string;
};

function extractConsensusAndId(j: XcmV3Junction | XcmV4Junction, n: NetworkId) {
  const network = j.asGlobalConsensus;
  if (network.type === 'Ethereum') {
    n.consensus = network.type.toLowerCase();
    n.chainId = network.asEthereum.chainId.toString();
  } else if (network.type !== 'ByFork' && network.type !== 'ByGenesis') {
    n.consensus = network.type.toLowerCase();
  }
}

function extractV3X1GlobalConsensus(junctions: XcmV3Junctions, n: NetworkId): NetworkURN | undefined {
  if (junctions.asX1.isGlobalConsensus) {
    extractConsensusAndId(junctions.asX1, n);
    if (n.consensus !== undefined && n.chainId !== undefined) {
      return `urn:ocn:${n.consensus}:${n.chainId}`;
    }
  }
  return undefined;
}

function networkIdFromV4(junctions: XcmV4Junctions): NetworkURN | undefined {
  if (junctions.type === 'Here') {
    return undefined;
  }

  const networkId: NetworkId = {};

  for (const j of junctions[`as${junctions.type}`]) {
    if (j.isGlobalConsensus) {
      extractConsensusAndId(j, networkId);
    }

    if (j.isParachain) {
      networkId.chainId = j.asParachain.toString();
    }

    if (networkId.consensus !== undefined && networkId.chainId !== undefined) {
      return `urn:ocn:${networkId.consensus}:${networkId.chainId}`;
    }
  }

  return undefined;
}

function networkIdFromV3(junctions: XcmV3Junctions): NetworkURN | undefined {
  if (junctions.type === 'Here') {
    return undefined;
  }

  const networkId: NetworkId = {};

  if (junctions.type === 'X1') {
    return extractV3X1GlobalConsensus(junctions, networkId);
  }

  for (const j of junctions[`as${junctions.type}`]) {
    if (j.isGlobalConsensus) {
      extractConsensusAndId(j, networkId);
    }

    if (j.isParachain) {
      networkId.chainId = j.asParachain.toString();
    }

    if (networkId.consensus !== undefined && networkId.chainId !== undefined) {
      return createNetworkId(networkId.consensus, networkId.chainId);
    }
  }

  return undefined;
}

// eslint-disable-next-line complexity
export function getParaIdFromMultiLocation(
  loc: XcmV2MultiLocation | XcmV3MultiLocation | XcmV4Location
): string | undefined {
  const junctions = loc.interior;
  if (junctions.type === 'Here') {
    if (loc.parents.toNumber() === 1) {
      return '0';
    }
    return undefined;
  }

  if (isV4Junctions(junctions)) {
    for (const j of junctions[`as${junctions.type}`]) {
      if (j.isParachain) {
        return j.asParachain.toString();
      }
    }
  } else {
    if (junctions.type === 'X1') {
      return junctions.asX1.isParachain ? junctions.asX1.asParachain.toString() : undefined;
    }
    for (const j of junctions[`as${junctions.type}`]) {
      if (j.isParachain) {
        return j.asParachain.toString();
      }
    }
  }

  return undefined;
}

export function networkIdFromMultiLocation(
  loc: XcmV2MultiLocation | XcmV3MultiLocation | XcmV4Location,
  currentNetworkId: NetworkURN
): NetworkURN | undefined {
  const { parents, interior: junctions } = loc;

  if (parents.toNumber() <= 1) {
    // is within current consensus system
    const paraId = getParaIdFromMultiLocation(loc);

    if (paraId !== undefined) {
      return createNetworkId(currentNetworkId, paraId);
    }
  } else if (parents.toNumber() > 1) {
    // is in other consensus system
    if (isV2Junctions(junctions)) {
      return undefined;
    }

    if (isV3Junctions(junctions)) {
      return networkIdFromV3(junctions);
    }

    if (isV4Junctions(junctions)) {
      return networkIdFromV4(junctions);
    }
  }
  return undefined;
}

export function networkIdFromVersionedMultiLocation(
  loc: XcmVersionedMultiLocation | XcmVersionedLocation,
  currentNetworkId: NetworkURN
): NetworkURN | undefined {
  switch (loc.type) {
    case 'V2':
    case 'V3':
      return networkIdFromMultiLocation(loc[`as${loc.type}`], currentNetworkId);
    case 'V4':
      return networkIdFromMultiLocation(loc.asV4, currentNetworkId);
    default:
      return undefined;
  }
}

export function matchProgramByTopic(message: XcmVersionedXcm, topicId: U8aFixed): boolean {
  switch (message.type) {
    case 'V2':
      throw new Error('Not able to match by topic for XCM V2 program.');
    case 'V3':
    case 'V4':
      for (const instruction of message[`as${message.type}`]) {
        if (instruction.isSetTopic) {
          return instruction.asSetTopic.eq(topicId);
        }
      }
      return false;
    default:
      throw new Error('XCM version not supported');
  }
}

export function matchEvent(event: types.BlockEvent, section: string | string[], method: string | string[]) {
  return (
    (Array.isArray(section) ? section.includes(event.section) : section === event.section) &&
    (Array.isArray(method) ? method.includes(event.method) : method === event.method)
  );
}

export function matchExtrinsic(extrinsic: types.ExtrinsicWithId, section: string, method: string | string[]): boolean {
  return section === extrinsic.method.section && Array.isArray(method)
    ? method.includes(extrinsic.method.method)
    : method === extrinsic.method.method;
}

function createTrappedAssetsFromMultiAssets(
  version: number,
  assets: XcmV2MultiassetMultiAssets | XcmV3MultiassetMultiAssets
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
  }));
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
  }));
}

function mapVersionedAssets(assets: XcmVersionedMultiAssets | XcmVersionedAssets): TrappedAsset[] {
  switch (assets.type) {
    case 'V2':
    case 'V3':
      return createTrappedAssetsFromMultiAssets(2, assets[`as${assets.type}`]);
    case 'V4':
      return createTrappedAssetsFromAssets(4, assets.asV4);
    default:
      throw new Error('XCM version not supported');
  }
}

export function mapAssetsTrapped(assetsTrappedEvent?: types.BlockEvent): AssetsTrapped | undefined {
  if (assetsTrappedEvent === undefined) {
    return undefined;
  }
  const [hash_, _, assets] = assetsTrappedEvent.data as unknown as [
    hash_: H256,
    _origin: any,
    assets: XcmVersionedMultiAssets | XcmVersionedAssets,
  ];
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
  };
}
