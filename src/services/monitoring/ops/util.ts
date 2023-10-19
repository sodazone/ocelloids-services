import type { VersionedXcm } from '@polkadot/types/interfaces/xcm';

import {
  HexString,
} from '../types.js';

/**
 * Gets message id from setTopic.
 */
export function getMessageId(program: VersionedXcm) {
  const instructions = program.value.toHuman() as any[];
  const setTopic = instructions.find((i: any) => i['SetTopic'] !== undefined);
  return setTopic ? setTopic['SetTopic'] as HexString : undefined;
}