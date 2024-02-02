import type {
  XcmVersionedXcm,
  XcmVersionedMultiLocation,
  XcmV3MultiLocation,
  XcmV2MultiLocation
} from '@polkadot/types/lookup';
import type { U8aFixed } from '@polkadot/types-codec';

import {
  HexString,
} from '../types.js';

/**
 * Gets message id from setTopic.
 */
export function getMessageId(program: XcmVersionedXcm): HexString | undefined {
  switch (program.type) {
    // For the moment only XCM V3 supports topic ID
    case 'V3':
      for(const instruction of program.asV3) {
        if (instruction.isSetTopic) {
          return instruction.asSetTopic.toHex()
        }
      }
      return undefined;
    default:
      return undefined;
  }
}

export function getParaId(loc: XcmV2MultiLocation | XcmV3MultiLocation): string | undefined {
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

export function getParaIdVersioned(loc: XcmVersionedMultiLocation): string | undefined {
  switch (loc.type) {
    case 'V2':
    case 'V3':
      return getParaId(loc[`as${loc.type}`]);
    default:
      return undefined;
  }
}

export function matchProgramByTopic(message: XcmVersionedXcm, topicId: U8aFixed): boolean {
  switch (message.type) {
    case 'V2':
      throw new Error('Not able to match by topic for XCM V2 program.')
    case 'V3':
      for(const instruction of message.asV3) {
        if (instruction.isSetTopic) {
          return instruction.asSetTopic.eq(topicId)
        }
      }
      return false;
    default:
      throw new Error('XCM version not supported');
  }
}