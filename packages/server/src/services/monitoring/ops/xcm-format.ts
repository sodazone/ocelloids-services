import type { Bytes } from '@polkadot/types';

import type { Registry } from '@polkadot/types/types';
import { XcmVersionedXcm } from './xcm-types.js';

/**
 * Creates a versioned XCM program from bytes.
 *
 * @param data The data bytes.
 * @param registry Optional - The registry to decode types.
 * @returns a versioned XCM program
 */
export function asVersionedXcm(data: Bytes | Uint8Array, registry: Registry): XcmVersionedXcm {
  if (registry.hasType('XcmVersionedXcm')) {
    // TODO patch types because bundled types are wrong
    return registry.createType('XcmVersionedXcm', data) as unknown as XcmVersionedXcm;
  } else if (registry.hasType('StagingXcmVersionedXcm')) {
    return registry.createType('StagingXcmVersionedXcm', data) as XcmVersionedXcm;
  }

  throw new Error('Versioned XCM type not found in chain registry');

  // TODO:does it make sense to default to Polka Reg?
  /*
  return polkadotRegistry().createType(
    'XcmVersionedXcm', data
  ) as XcmVersionedXcm;
  */
}

function asXcmpVersionedXcms(buffer: Uint8Array, registry: Registry): XcmVersionedXcm[] {
  const len = buffer.length;
  const xcms: XcmVersionedXcm[] = [];
  let ptr = 1;

  while (ptr < len) {
    try {
      const xcm = asVersionedXcm(buffer.slice(ptr), registry);
      xcms.push(xcm);
      ptr += xcm.encodedLength;
    } catch (error) {
      // TODO use logger
      console.error(error);
      break;
    }
  }

  return xcms;
}

/**
 * Decodes XCMP message formats.
 *
 * @param buf The data buffer.
 * @param registry Optional - The registry to decode types.
 * @returns an array of {@link VersionedXcm} programs.
 */
export function fromXcmpFormat(buf: Uint8Array, registry: Registry): XcmVersionedXcm[] {
  switch (buf[0]) {
    case 0x00: {
      // Concatenated XCM fragments
      return asXcmpVersionedXcms(buf, registry);
    }
    case 0x01: {
      // XCM blobs
      // XCM blobs not supported, ignore
      break;
    }
    case 0x02: {
      // Signals
      // TODO handle signals
      break;
    }
    default: {
      throw new Error('Unknown XCMP format');
    }
  }
  return [];
}
