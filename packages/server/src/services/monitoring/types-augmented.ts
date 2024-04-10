import { Observable } from 'rxjs';

import type { Vec, Bytes } from '@polkadot/types';
import type {
  PolkadotCorePrimitivesOutboundHrmpMessage,
  PolkadotCorePrimitivesInboundDownwardMessage,
} from '@polkadot/types/lookup';
import { HexString } from './types.js';
import { NetworkURN } from '../types.js';

export type GetOutboundHrmpMessages = (hash: HexString) => Observable<Vec<PolkadotCorePrimitivesOutboundHrmpMessage>>;

export type GetOutboundUmpMessages = (hash: HexString) => Observable<Vec<Bytes>>;

export type GetDownwardMessageQueues = (
  hash: HexString,
  networkId: NetworkURN
) => Observable<Vec<PolkadotCorePrimitivesInboundDownwardMessage>>;

export type GetStorageAt = (hash: HexString, key: HexString) => Observable<Uint8Array>;
