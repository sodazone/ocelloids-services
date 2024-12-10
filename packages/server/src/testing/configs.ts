import { ServiceConfiguration } from '../services/config.js'

export const mockConfigWS = new ServiceConfiguration({
  substrate: {
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
  },
})

export const mockConfigRelayLast = new ServiceConfiguration({
  substrate: {
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
          type: 'rpc',
          url: 'wss://shiden.io',
        },
      },
      {
        id: 'urn:ocn:local:0',
        provider: {
          type: 'rpc',
          url: 'wss://somewhere.io',
        },
      },
    ],
  },
})
