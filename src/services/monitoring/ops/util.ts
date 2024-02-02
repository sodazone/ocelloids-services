import type { XcmVersionedXcm } from '@polkadot/types/lookup';

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

