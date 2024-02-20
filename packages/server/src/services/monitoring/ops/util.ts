import type {
  XcmVersionedXcm,
  XcmVersionedMultiLocation,
  XcmV3MultiLocation,
  XcmV2MultiLocation,
  XcmVersionedMultiAssets,
  XcmV2MultiassetMultiAssets,
  XcmV3MultiassetMultiAssets,
  PolkadotRuntimeParachainsInclusionAggregateMessageOrigin
} from '@polkadot/types/lookup';
import type { U8aFixed } from '@polkadot/types-codec';
import type { H256 } from '@polkadot/types/interfaces/runtime';

import { types } from '@sodazone/ocelloids';

import {
  AssetsTrapped,
  HexString,
  TrappedAsset,
} from '../types.js';

/**
 * Gets message id from setTopic.
 */
export function getMessageId(program: XcmVersionedXcm): HexString | undefined {
  switch (program.type) {
  // For the moment only XCM V3 supports topic ID
  case 'V3':
    for (const instruction of program.asV3) {
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

// eslint-disable-next-line complexity
export function getParaIdFromMultiLocation(
  loc: XcmV2MultiLocation | XcmV3MultiLocation
): string | undefined {
  const junctions = loc.interior;
  switch (junctions.type) {
  case 'Here':
    return undefined;
  case 'X1':
    return junctions.asX1.isParachain ? junctions.asX1.asParachain.toString() : undefined;
  case 'X2':
  case 'X3':
  case 'X4':
  case 'X5':
  case 'X6':
  case 'X7':
  case 'X8':
    for (const j of junctions[`as${junctions.type}`]) {
      if (j.isParachain) {
        return j.asParachain.toString();
      }
    }
    return undefined;
  default:
    return undefined;
  }
}

export function getParaIdFromVersionedMultiLocation(loc: XcmVersionedMultiLocation): string | undefined {
  switch (loc.type) {
  case 'V2':
  case 'V3':
    return getParaIdFromMultiLocation(loc[`as${loc.type}`]);
  default:
    return undefined;
  }
}

export function matchProgramByTopic(message: XcmVersionedXcm, topicId: U8aFixed): boolean {
  switch (message.type) {
  case 'V2':
    throw new Error('Not able to match by topic for XCM V2 program.');
  case 'V3':
    for (const instruction of message.asV3) {
      if (instruction.isSetTopic) {
        return instruction.asSetTopic.eq(topicId);
      }
    }
    return false;
  default:
    throw new Error('XCM version not supported');
  }
}

export function matchEvent(
  event: types.BlockEvent,
  section: string,
  method: string | string[]
) {
  return section === event.section
  && Array.isArray(method)
    ? method.includes(event.method)
    : method === event.method;
}

export function matchExtrinsic(
  extrinsic: types.ExtrinsicWithId,
  section: string,
  method: string | string[]
): boolean {
  return section === extrinsic.method.section
  && Array.isArray(method)
    ? method.includes(extrinsic.method.method)
    : method === extrinsic.method.method;
}

function createTrappedAssets(
  version: number,
  assets: XcmV2MultiassetMultiAssets | XcmV3MultiassetMultiAssets
): TrappedAsset[] {
  return assets.map(a => ({
    version,
    id: {
      type: a.id.type,
      value: a.id.isConcrete ? a.id.asConcrete.toHuman() : a.id.asAbstract.toHex()
    },
    fungible: a.fun.isFungible,
    amount: a.fun.isFungible ? a.fun.asFungible.toPrimitive() : 1,
    assetInstance: a.fun.isNonFungible ? a.fun.asNonFungible.toHuman(): undefined
  }));
}

function mapVersionedAssets(assets: XcmVersionedMultiAssets): TrappedAsset[] {
  switch (assets.type) {
  case 'V2':
    return createTrappedAssets(2, assets.asV2);
  case 'V3':
    return createTrappedAssets(3, assets.asV3);
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
    assets: XcmVersionedMultiAssets
  ];
  return {
    event: {
      eventId: assetsTrappedEvent.eventId,
      blockNumber: assetsTrappedEvent.blockNumber.toPrimitive(),
      blockHash: assetsTrappedEvent.blockHash.toHex(),
      section: assetsTrappedEvent.section,
      method: assetsTrappedEvent.method
    },
    assets: mapVersionedAssets(assets),
    hash: hash_.toHex()
  };
}