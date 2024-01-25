import { ApiPromise } from '@polkadot/api';
import type { Bytes } from '@polkadot/types';
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

/**
 * Creates a versioned XCM program from bytes.
 *
 * @param api The Api instance with the type registry.
 * @param data The data bytes.
 * @returns a versioned XCM program
 */
export function asVersionedXcm(api: ApiPromise, data: Bytes)
: VersionedXcm {
  return api.registry.createType(
    'VersionedXcm', data
  );
}