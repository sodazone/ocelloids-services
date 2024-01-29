import type { Bytes } from '@polkadot/types';
import type { VersionedXcm } from '@polkadot/types/interfaces/xcm';

import { TypeRegistry, Metadata } from '@polkadot/types';
import staticMetadata from '@polkadot/types-support/metadata/static-polkadot';

import {
  HexString,
} from '../types.js';

// TODO: encapsulate without side effects
const registry = new TypeRegistry();
const metadata = new Metadata(registry, staticMetadata);
registry.setMetadata(metadata);

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
 * @param data The data bytes.
 * @returns a versioned XCM program
 */
export function asVersionedXcm(data: Bytes | Uint8Array)
: VersionedXcm {
  return registry.createType(
    'XcmVersionedXcm', data
  );
}