import { map, Observable } from 'rxjs';

import type { Registry } from '@polkadot/types/types';
import type { XcmV2Xcm, XcmV3Xcm, XcmV3Instruction } from '@polkadot/types/lookup';

import { GenericXcmSent, XcmSent, XcmSentWithContext } from '../types.js';
import { getBridgeHubNetworkId, getParaIdFromJunctions, networkIdFromMultiLocation } from './util.js';
import { asVersionedXcm } from './xcm-format.js';
import { XcmV4Xcm, XcmV4Instruction } from './xcm-types.js';
import { NetworkURN } from '../../types.js';
import { createNetworkId } from '../../config.js';

// eslint-disable-next-line complexity
function recursiveExtractStops(origin: NetworkURN, instructions: XcmV2Xcm | XcmV3Xcm | XcmV4Xcm, stops: NetworkURN[]) {
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
    } else if ((instruction as XcmV3Instruction | XcmV4Instruction).isExportMessage) {
      const { network, destination, xcm } = (instruction as XcmV3Instruction | XcmV4Instruction).asExportMessage;
      const paraId = getParaIdFromJunctions(destination)
      if (paraId) {
        const consensus = network.toString().toLowerCase();
        const networkId = createNetworkId(consensus, paraId)
        const bridgeHubNetworkId = getBridgeHubNetworkId(consensus)
        // We assume that an ExportMessage will always go through Bridge Hub
        if (bridgeHubNetworkId !== undefined && networkId !== bridgeHubNetworkId) {
          stops.push(bridgeHubNetworkId)
        }
        stops.push(networkId);
        recursiveExtractStops(networkId, xcm, stops);
      }
    }

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

/**
 * Maps a XcmSentWithContext to a XcmSent message.
 * Sets the destination as the final stop after recursively extracting all stops from the XCM message,
 * constructs the legs for the message and constructs the waypoint context.
 *
 * @param id subscription ID
 * @param registry type registry
 * @param origin origin network URN
 * @returns Observable<XcmSent>
 */
export function mapXcmSent(id: string, registry: Registry, origin: NetworkURN) {
  return (source: Observable<XcmSentWithContext>): Observable<XcmSent> =>
    source.pipe(
      map((message) => {
        const { instructions, recipient } = message;
        const stops: NetworkURN[] = [recipient];
        const versionedXcm = asVersionedXcm(instructions.bytes, registry);
        recursiveExtractStops(origin, versionedXcm[`as${versionedXcm.type}`], stops);
        return new GenericXcmSent(id, origin, message, stops);
      })
    );
}
