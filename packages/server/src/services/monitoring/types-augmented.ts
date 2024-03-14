import { Observable } from 'rxjs';

import type { Vec, Bytes } from '@polkadot/types';
import type { Registry } from '@polkadot/types-codec/types';
import type {
  PolkadotCorePrimitivesOutboundHrmpMessage,
  PolkadotCorePrimitivesInboundDownwardMessage,
} from '@polkadot/types/lookup';
import { HexString } from './types.js';

export type GetOutboundHrmpMessages = (
  registry: Registry,
  hash: HexString
) => Observable<Vec<PolkadotCorePrimitivesOutboundHrmpMessage>>;

export type GetOutboundUmpMessages = (registry: Registry, hash: HexString) => Observable<Vec<Bytes>>;

export type GetDownwardMessageQueues = (
  registry: Registry,
  hash: HexString,
  paraId: string
) => Observable<Vec<PolkadotCorePrimitivesInboundDownwardMessage>>;
