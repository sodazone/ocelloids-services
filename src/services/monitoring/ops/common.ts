import { switchMap, mergeMap, map, filter, from, Observable } from 'rxjs';

import type {
  XcmVersionedXcm,
  XcmV2Xcm,
  XcmV3Xcm,
  XcmV2MultiLocation,
  XcmV3MultiLocation
} from '@polkadot/types/lookup';

import { XcmSentWithContext } from '../types.js';
import { getParaIdFromMultiLocation } from './util.js';

function updateStops(
  stops: string[],
  destination: XcmV3MultiLocation | XcmV2MultiLocation,
  xcm: XcmV3Xcm | XcmV2Xcm
) {
  const paraId = getParaIdFromMultiLocation(destination);
  if (paraId) {
    stops.push(paraId);
  }

  recursiveExtractStops(xcm, stops);
}

function recursiveExtractStops(message: XcmV3Xcm | XcmV2Xcm, stops: string[]) {
  for (const instruction of message) {
    if (instruction.isDepositReserveAsset) {
      const { dest, xcm } = instruction.asDepositReserveAsset;
      updateStops(stops, dest, xcm);
    } else if (instruction.isInitiateReserveWithdraw) {
      const { reserve, xcm } = instruction.asInitiateReserveWithdraw;
      updateStops(stops, reserve, xcm);
    } else if (instruction.isInitiateTeleport) {
      const { dest, xcm } = instruction.asInitiateTeleport;
      updateStops(stops, dest, xcm);
    } else if (instruction.isTransferReserveAsset) {
      const { dest, xcm } = instruction.asTransferReserveAsset;
      updateStops(stops, dest, xcm);
    }
  }
  return stops;
}

function extractStops(message: XcmVersionedXcm, nextStop: string): string[] {
  const stops = [nextStop];

  switch (message.type) {
  case 'V2':
    recursiveExtractStops(message.asV3, stops);
    return stops;
  case 'V3':
    recursiveExtractStops(message.asV3, stops);
    return stops;
  default:
    throw new Error('XCM version not supported');
  }
}

export function extractXcmWaypoints() {
  return (
    source: Observable<XcmSentWithContext>
  ) => source.pipe(
    map(message => {
      const { instructions, recipient } = message;
      const stops = extractStops(instructions, recipient);
      return { message, stops }
    })
  );
}