import { pino } from 'pino';

import { ServiceConfiguration } from '../services/configuration.js';

export const mockLog: pino.BaseLogger = pino({
  enabled: false
});

export const mockConfigProviderMismatch: ServiceConfiguration = {
  networks: [
    {
      name: 'kusama',
      id: 0,
      provider: {
        type: 'rpc',
        url: 'wss://kusama.io'
      }
    },
    {
      name: 'shiden',
      id: 2006,
      relay: 'kusama',
      provider: {
        type: 'smoldot',
        spec: './chain-specs/shiden.json'
      }
    }
  ]
};

export const mockConfigRelayMismatch: ServiceConfiguration = {
  networks: [
    {
      name: 'polkadot',
      id: 0,
      provider: {
        type: 'smoldot',
        spec: './chain-specs/polkadot.json'
      }
    },
    {
      name: 'asset-hub',
      id: 1000,
      relay: 'rococo',
      provider: {
        type: 'smoldot',
        spec: './chain-specs/ah.json'
      }
    }
  ]
};

export const mockConfigLC: ServiceConfiguration = {
  networks: [
    {
      name: 'polkadot',
      id: 0,
      provider: {
        type: 'smoldot',
        spec: './chain-specs/polkadot.json'
      }
    },
    {
      name: 'asset-hub',
      id: 1000,
      relay: 'polkadot',
      provider: {
        type: 'smoldot',
        spec: './chain-specs/ah.json'
      }
    },
    {
      name: 'astar',
      id: 2006,
      relay: 'polkadot',
      provider: {
        type: 'smoldot',
        spec: './chain-specs/astar.json'
      }
    }
  ]
};

export const mockConfigWS: ServiceConfiguration = {
  networks: [
    {
      name: 'polkadot',
      id: 0,
      provider: {
        type: 'rpc',
        url: 'wss://polkadot.io'
      }
    },
    {
      name: 'asset-hub',
      id: 1000,
      relay: 'polkadot',
      provider: {
        type: 'rpc',
        url: 'wss://asset-hub.io'
      }
    },
    {
      name: 'astar',
      id: 2006,
      relay: 'polkadot',
      provider: {
        type: 'rpc',
        url: 'wss://astar.io'
      }
    }
  ]
};

export const mockConfigMixed: ServiceConfiguration = {
  networks: [
    {
      name: 'polkadot',
      id: 0,
      provider: {
        type: 'smoldot',
        spec: './chain-specs/polkadot.json'
      }
    },
    {
      name: 'asset-hub',
      id: 1000,
      relay: 'polkadot',
      provider: {
        type: 'rpc',
        url: 'wss://asset-hub.io'
      }
    },
    {
      name: 'astar',
      id: 2006,
      relay: 'polkadot',
      provider: {
        type: 'smoldot',
        spec: './chain-specs/astar.json'
      }
    }
  ]
};

export const mockConfigRelayLast: ServiceConfiguration = {
  networks: [
    {
      name: 'asset-hub',
      id: 1000,
      relay: 'kusama',
      provider: {
        type: 'rpc',
        url: 'wss://asset-hub.io'
      }
    },
    {
      name: 'shiden',
      id: 2006,
      relay: 'kusama',
      provider: {
        type: 'smoldot',
        spec: './chain-specs/shiden.json'
      }
    },
    {
      name: 'kusama',
      id: 0,
      provider: {
        type: 'smoldot',
        spec: './chain-specs/kusama.json'
      }
    }
  ]
};

