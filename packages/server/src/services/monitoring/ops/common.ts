import { map, Observable } from 'rxjs';

import type { Registry } from '@polkadot/types/types';
import type { XcmV2Xcm, XcmV3Xcm, XcmV2MultiLocation, XcmV3MultiLocation } from '@polkadot/types/lookup';

import { XcmSentWithContext } from '../types.js';
import { getParaIdFromLocation, getParaIdFromMultiLocation, isV4Location } from './util.js';
import { asVersionedXcm } from './xcm-format.js';
import { XcmV4Xcm, XcmV4Location } from './xcm-types.js';

function updateStops(stops: string[], destination: XcmV3MultiLocation | XcmV2MultiLocation | XcmV4Location) {
  let paraId: string | undefined;
  if (isV4Location(destination)) {
    paraId = getParaIdFromLocation(destination);
  } else {
    paraId = getParaIdFromMultiLocation(destination);
  }
  if (paraId) {
    stops.push(paraId);
  }
}

function recursiveExtractStops(message: XcmV2Xcm | XcmV3Xcm | XcmV4Xcm, stops: string[]) {
  for (const instruction of message) {
    if (instruction.isDepositReserveAsset) {
      const { dest, xcm } = instruction.asDepositReserveAsset;
      updateStops(stops, dest);
      recursiveExtractStops(xcm, stops);
    } else if (instruction.isInitiateReserveWithdraw) {
      const { reserve, xcm } = instruction.asInitiateReserveWithdraw;
      updateStops(stops, reserve);
      recursiveExtractStops(xcm, stops);
    } else if (instruction.isInitiateTeleport) {
      const { dest, xcm } = instruction.asInitiateTeleport;
      updateStops(stops, dest);
      recursiveExtractStops(xcm, stops);
    } else if (instruction.isTransferReserveAsset) {
      const { dest, xcm } = instruction.asTransferReserveAsset;
      updateStops(stops, dest);
      recursiveExtractStops(xcm, stops);
    }
  }
  return stops;
}

export function extractXcmWaypoints(registry: Registry) {
  return (source: Observable<XcmSentWithContext>) =>
    source.pipe(
      map((message) => {
        const { instructions, recipient } = message;
        const stops = [recipient];
        const versionedXcm = asVersionedXcm(instructions.bytes, registry);
        recursiveExtractStops(versionedXcm[`as${versionedXcm.type}`], stops);
        return { message, stops };
      })
    );
}
