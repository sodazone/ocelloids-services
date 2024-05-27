import { ServiceConfiguration } from '../services/config.js'

export const mockConfigProviderMismatch: ServiceConfiguration = {
  networks: [
    {
      id: 'urn:ocn:local:0',
      provider: {
        type: 'rpc',
        url: 'wss://kusama.io',
      },
    },
    {
      id: 'urn:ocn:local:2006',
      relay: 'urn:ocn:local:0',
      provider: {
        type: 'smoldot',
        spec: './chain-specs/shiden.json',
      },
    },
  ],
}

export const mockConfigRelayMismatch: ServiceConfiguration = {
  networks: [
    {
      id: 'urn:ocn:rococo:0',
      provider: {
        type: 'smoldot',
        spec: './chain-specs/polkadot.json',
      },
    },
    {
      id: 'urn:ocn:rococo:1000',
      relay: 'urn:ocn:local:0',
      provider: {
        type: 'smoldot',
        spec: './chain-specs/ah.json',
      },
    },
  ],
}

export const mockConfigLC: ServiceConfiguration = {
  networks: [
    {
      id: 'urn:ocn:local:0',
      provider: {
        type: 'smoldot',
        name: 'polkadot',
        spec: './chain-specs/polkadot.json',
      },
    },
    {
      id: 'urn:ocn:local:1000',
      relay: 'urn:ocn:local:0',
      provider: {
        type: 'smoldot',
        spec: './chain-specs/ah.json',
      },
    },
    {
      id: 'urn:ocn:local:2006',
      relay: 'urn:ocn:local:0',
      provider: {
        type: 'smoldot',
        spec: './chain-specs/astar.json',
      },
    },
  ],
}

export const mockConfigWS: ServiceConfiguration = {
  networks: [
    {
      id: 'urn:ocn:local:0',
      provider: {
        type: 'rpc',
        url: 'wss://polkadot.io',
      },
      recovery: true,
      batchSize: 5,
    },
    {
      id: 'urn:ocn:local:1000',
      relay: 'urn:ocn:local:0',
      provider: {
        type: 'rpc',
        url: 'wss://asset-hub.io',
      },
    },
    {
      id: 'urn:ocn:local:2006',
      relay: 'urn:ocn:local:0',
      provider: {
        type: 'rpc',
        url: 'wss://astar.io',
      },
    },
  ],
}

export const mockConfigMixed: ServiceConfiguration = {
  networks: [
    {
      id: 'urn:ocn:local:0',
      provider: {
        type: 'smoldot',
        name: 'polkadot',
        spec: './chain-specs/polkadot.json',
      },
    },
    {
      id: 'urn:ocn:local:1000',
      relay: 'urn:ocn:local:0',
      provider: {
        type: 'rpc',
        url: 'wss://asset-hub.io',
      },
    },
    {
      id: 'urn:ocn:local:2032',
      relay: 'urn:ocn:local:0',
      provider: {
        type: 'smoldot',
        spec: './chain-specs/interlay.json',
      },
    },
  ],
}

export const mockConfigRelayLast: ServiceConfiguration = {
  networks: [
    {
      id: 'urn:ocn:local:1000',
      relay: 'urn:ocn:local:0',
      provider: {
        type: 'rpc',
        url: 'wss://asset-hub.io',
      },
    },
    {
      id: 'urn:ocn:local:2006',
      relay: 'urn:ocn:local:0',
      provider: {
        type: 'smoldot',
        spec: './chain-specs/shiden.json',
      },
    },
    {
      id: 'urn:ocn:local:0',
      provider: {
        type: 'smoldot',
        spec: './chain-specs/kusama.json',
      },
    },
  ],
}
