import { map, Observable } from 'rxjs';

import type { Registry } from '@polkadot/types/types';
import type { XcmV2Xcm, XcmV3Xcm } from '@polkadot/types/lookup';

import { XcmSentWithContext } from '../types.js';
import { networkIdFromMultiLocation } from './util.js';
import { asVersionedXcm } from './xcm-format.js';
import { XcmV4Xcm } from './xcm-types.js';

// eslint-disable-next-line complexity
function recursiveExtractStops(origin: string, instructions: XcmV2Xcm | XcmV3Xcm | XcmV4Xcm, stops: string[]) {
  for (const instruction of instructions) {
    let nextStop;
    let message;

    if (instruction.isDepositReserveAsset) {
      const { dest, xcm } = instruction.asDepositReserveAsset;
      nextStop = dest;
      message = xcm;
    } else if (instruction.isInitiateReserveWithdraw) {
      const { reserve, xcm } = instruction.asInitiateReserveWithdraw;
      nextStop = reserve;
      message = xcm;
    } else if (instruction.isInitiateTeleport) {
      const { dest, xcm } = instruction.asInitiateTeleport;
      nextStop = dest;
      message = xcm;
    } else if (instruction.isTransferReserveAsset) {
      const { dest, xcm } = instruction.asTransferReserveAsset;
      nextStop = dest;
      message = xcm;
    }
    // TODO: support ExportMessage for bridges

    if (nextStop !== undefined && message !== undefined) {
      const networkId = networkIdFromMultiLocation(nextStop, origin);

      if (networkId) {
        stops.push(networkId);
        recursiveExtractStops(networkId, message, stops);
      }
    }
  }

  return stops;
}

export function extractXcmWaypoints(registry: Registry, origin: string) {
  return (source: Observable<XcmSentWithContext>) =>
    source.pipe(
      map((message) => {
        const { instructions, recipient } = message;
        const stops = [recipient];
        const versionedXcm = asVersionedXcm(instructions.bytes, registry);
        recursiveExtractStops(origin, versionedXcm[`as${versionedXcm.type}`], stops);
        return { message, stops };
      })
    );
}
