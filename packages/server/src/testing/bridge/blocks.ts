/* eslint-disable max-len */
import '@polkadot/api-augment/polkadot';

import { from } from 'rxjs';

import { TypeRegistry, Metadata } from '@polkadot/types';
import type { Vec } from '@polkadot/types';
import type { PolkadotCorePrimitivesOutboundHrmpMessage } from '@polkadot/types/lookup';
import spec from '@polkadot/types-support/metadata/static-polkadot';

import { ControlQuery } from '@sodazone/ocelloids-sdk';

import { testBlocksFrom } from '../blocks.js';
import { NetworkURN } from '../../services/types.js';
import { messageCriteria } from '../../services/monitoring/ops/criteria.js';

const _registry = new TypeRegistry();
const metadata = new Metadata(_registry, spec);
_registry.setMetadata(metadata);
export const registry = _registry;

// XCMP on Kusama consensus
const xcmpDataKSMAssetHub =
  '0x0003180004000100000740568a4a5f13000100000740568a4a5f0026020100a10f1401040002010903000700e87648170a130002010903000700e8764817000d010204000101002cb783d5c0ddcccd2608c83d43ee6fc19320408c24764c2f8ac164b27beaee372cf7d2f132944c0c518b4c862d6e68030f0ba49808125a805a11a9ede30d0410ab140d0100010100a10f2c4b422c686214e14cc3034a661b6a01dfd2c9a811ef9ec20ef798d0e687640e6d';
export const xcmpSendKusamaAssetHub = {
  origin: 'urn:ocn:kusama:1000' as NetworkURN,
  blocks: from(testBlocksFrom('ksm-assethub-bridge-xcm-out.cbor.bin', 'kusama-asset-hub.json')),
  getHrmp: () =>
    from([
      [
        {
          recipient: {
            toNumber: () => 1002,
          },
          data: registry.createType('Bytes', xcmpDataKSMAssetHub),
        },
      ] as unknown as Vec<PolkadotCorePrimitivesOutboundHrmpMessage>,
    ]),
};

export const xcmpReceiveKusamaBridgeHub = from(
  testBlocksFrom('ksm-bridgehub-bridge-xcm-in.cbor.bin', 'kusama-bridge-hub.json')
);

export const relayHrmpReceiveKusama = {
  blocks: from(testBlocksFrom('ksm-bridge-xcm-relay.cbor.bin', 'kusama.json')),
  messageControl: new ControlQuery(messageCriteria(['urn:ocn:kusama:1000', 'urn:ocn:kusama:1002', 'urn:ocn:kusama:0'])),
  origin: 'urn:ocn:kusama:1000',
  destination: 'urn:ocn:kusama:1002',
};

// XCMP on Polkadot consensus
const xcmpDataDOTAssetHub =
  '0x0003200b0104352509030b0100a10f01040002010903000700e87648170a130002010903000700e8764817000d010204000101002cb783d5c0ddcccd2608c83d43ee6fc19320408c24764c2f8ac164b27beaee372cf7d2f132944c0c518b4c862d6e68030f0ba49808125a805a11a9ede30d0410ab';
export const xcmpSendPolkadotBridgeHub = {
  origin: 'urn:ocn:polkadot:1002' as NetworkURN,
  blocks: from(testBlocksFrom('dot-bridgehub-bridge-in.cbor.bin', 'polkadot-bridge-hub.json')),
  getHrmp: () =>
    from([
      [
        {
          recipient: {
            toNumber: () => 1000,
          },
          data: registry.createType('Bytes', xcmpDataDOTAssetHub),
        },
      ] as unknown as Vec<PolkadotCorePrimitivesOutboundHrmpMessage>,
    ]),
};

export const xcmpReceivePolkadotAssetHub = from(
  testBlocksFrom('dot-assethub-bridge-xcm-in.cbor.bin', 'polkadot-asset-hub-1001002.json')
);

export const relayHrmpReceivePolkadot = {
  blocks: from(testBlocksFrom('dot-bridge-xcm-relay.cbor.bin', 'polkadot-1000001.json')),
  messageControl: new ControlQuery(
    messageCriteria(['urn:ocn:polkadot:1000', 'urn:ocn:polkadot:1002', 'urn:ocn:polkadot:0'])
  ),
  origin: 'urn:ocn:polkadot:1002',
  destination: 'urn:ocn:polkadot:1000',
};

// Bridge blocks
const ksmBridgeData =
  'dd010302090200a10f031c2509030b0100a10f01040002010903000700e87648170a130002010903000700e8764817000d010204000101002cb783d5c0ddcccd2608c83d43ee6fc19320408c24764c2f8ac164b27beaee372cf7d2f132944c0c518b4c862d6e68030f0ba49808125a805a11a9ede30d0410ab';
export const bridgeOutKusama = {
  origin: 'urn:ocn:kusama:1002',
  blocks: from(testBlocksFrom('ksm-bridgehub-bridge-out.cbor.bin', 'kusama-bridge-hub.json')),
  getStorage: () => from([new Uint8Array(Buffer.from(ksmBridgeData, 'hex'))]),
};

export const bridgeInPolkadot = {
  origin: 'urn:ocn:polkadot:1002',
  blocks: from(testBlocksFrom('dot-bridgehub-bridge-in.cbor.bin', 'polkadot-bridge-hub.json')),
};
