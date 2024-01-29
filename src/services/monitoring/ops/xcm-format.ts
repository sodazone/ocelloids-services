import { createRequire } from 'node:module';

import type { Bytes } from '@polkadot/types';
import type { VersionedXcm } from '@polkadot/types/interfaces/xcm';

import { TypeRegistry, Metadata } from '@polkadot/types';

let _registry : TypeRegistry;

function polkadotRegistry() : TypeRegistry {
  if (_registry) {
    return _registry;
  }
  _registry = new TypeRegistry();
  const require = createRequire(import.meta.url);
  const spec = require('@polkadot/types-support/metadata/static-polkadot').default;
  const metadata = new Metadata(_registry, spec);
  _registry.setMetadata(metadata);
  return _registry;
}

/**
 * Creates a versioned XCM program from bytes.
 *
 * @param data The data bytes.
 * @param registry Optional - The registry to decode types.
 * @returns a versioned XCM program
 */
export function asVersionedXcm(
  data: Bytes | Uint8Array,
  registry = polkadotRegistry()
): VersionedXcm {
  return registry.createType(
    'XcmVersionedXcm', data
  );
}

function asXcmpVersionedXcms(
  buffer: Uint8Array,
  registry = polkadotRegistry()
) : VersionedXcm[] {
  const len = buffer.length;
  const xcms : VersionedXcm[] = [];
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
export function fromXcmpFormat(
  buf: Uint8Array,
  registry = polkadotRegistry()
) : VersionedXcm[] {
  switch (buf[0]) {
  case 0x00: { // Concatenated XCM fragments
    return asXcmpVersionedXcms(buf, registry);
  }
  case 0x01: { // XCM blobs
    // XCM blobs not supported, ignore
    break;
  }
  case 0x02: { // Signals
    // TODO handle signals
    break;
  }
  default: {
    throw new Error('Unknown XCMP format');
  }
  }
  return [];
}