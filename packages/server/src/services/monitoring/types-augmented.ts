import { Observable } from 'rxjs';

import type { Vec, Bytes } from '@polkadot/types';
import type { PolkadotCorePrimitivesOutboundHrmpMessage } from '@polkadot/types/lookup';

export type GetOutboundHrmpMessages = (
  hash: `0x${string}`
) => Observable<Vec<PolkadotCorePrimitivesOutboundHrmpMessage>>;

export type GetOutboundUmpMessages = (hash: `0x${string}`) => Observable<Vec<Bytes>>;
