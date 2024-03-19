import { ServiceConfiguration } from '../services/config.js';

export const mockConfigProviderMismatch: ServiceConfiguration = {
  networks: [
    {
      name: 'kusama',
      id: 'urn:ocn:local:0',
      provider: {
        type: 'rpc',
        url: 'wss://kusama.io',
      },
    },
    {
      name: 'shiden',
      id: 'urn:ocn:local:2006',
      relay: 'kusama',
      provider: {
        type: 'smoldot',
        spec: './chain-specs/shiden.json',
      },
    },
  ],
};

export const mockConfigRelayMismatch: ServiceConfiguration = {
  networks: [
    {
      name: 'local',
      id: 'urn:ocn:rococo:0',
      provider: {
        type: 'smoldot',
        spec: './chain-specs/polkadot.json',
      },
    },
    {
      name: 'asset-hub',
      id: 'urn:ocn:rococo:1000',
      relay: 'rococo',
      provider: {
        type: 'smoldot',
        spec: './chain-specs/ah.json',
      },
    },
  ],
};

export const mockConfigLC: ServiceConfiguration = {
  networks: [
    {
      name: 'polkadot',
      id: 'urn:ocn:local:0',
      provider: {
        type: 'smoldot',
        spec: './chain-specs/polkadot.json',
      },
    },
    {
      name: 'asset-hub',
      id: 'urn:ocn:local:1000',
      relay: 'polkadot',
      provider: {
        type: 'smoldot',
        spec: './chain-specs/ah.json',
      },
    },
    {
      name: 'astar',
      id: 'urn:ocn:local:2006',
      relay: 'polkadot',
      provider: {
        type: 'smoldot',
        spec: './chain-specs/astar.json',
      },
    },
  ],
};

export const mockConfigWS: ServiceConfiguration = {
  networks: [
    {
      name: 'polkadot',
      id: 'urn:ocn:local:0',
      provider: {
        type: 'rpc',
        url: 'wss://polkadot.io',
      },
      recovery: true,
      batchSize: 5,
    },
    {
      name: 'asset-hub',
      id: 'urn:ocn:local:1000',
      relay: 'polkadot',
      provider: {
        type: 'rpc',
        url: 'wss://asset-hub.io',
      },
    },
    {
      name: 'astar',
      id: 'urn:ocn:local:2006',
      relay: 'polkadot',
      provider: {
        type: 'rpc',
        url: 'wss://astar.io',
      },
    },
  ],
};

export const mockConfigMixed: ServiceConfiguration = {
  networks: [
    {
      name: 'polkadot',
      id: 'urn:ocn:local:0',
      provider: {
        type: 'smoldot',
        spec: './chain-specs/polkadot.json',
      },
    },
    {
      name: 'asset-hub',
      id: 'urn:ocn:local:1000',
      relay: 'polkadot',
      provider: {
        type: 'rpc',
        url: 'wss://asset-hub.io',
      },
    },
    {
      name: 'interlay',
      id: 'urn:ocn:local:2032',
      relay: 'polkadot',
      provider: {
        type: 'smoldot',
        spec: './chain-specs/interlay.json',
      },
    },
  ],
};

export const mockConfigRelayLast: ServiceConfiguration = {
  networks: [
    {
      name: 'asset-hub',
      id: 'urn:ocn:local:1000',
      relay: 'kusama',
      provider: {
        type: 'rpc',
        url: 'wss://asset-hub.io',
      },
    },
    {
      name: 'shiden',
      id: 'urn:ocn:local:2006',
      relay: 'kusama',
      provider: {
        type: 'smoldot',
        spec: './chain-specs/shiden.json',
      },
    },
    {
      name: 'kusama',
      id: 'urn:ocn:local:0',
      provider: {
        type: 'smoldot',
        spec: './chain-specs/kusama.json',
      },
    },
  ],
};
