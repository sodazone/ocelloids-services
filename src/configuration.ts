
export type NetworkConfiguration = {
  name: string,
  id: number,
  relay?: string,
  provider: {
    type: 'rpc' | 'smoldot',
    url?: string,
    spec?: string
  }
}

export type ServiceConfiguration = {
    networks: NetworkConfiguration[]
}

export const DummyConfiguration  = {
  'networks': [
    /*
    {
      'name': 'assethub',
      'id': 1000,
      'relay': 'polkadot',
      'provider': {
        'type': 'rpc',
        'url': 'wss://polkadot-asset-hub-rpc.polkadot.io'
      }
    },
    {
      'name': 'astar',
      'id': 2012,
      'relay': 'polkadot',
      'provider': {
        'type': 'smoldot',
        'spec': './chain-specs/polkadot-astar.json'
      }
    }*/
    {
      'name': 'rococo_local_testnet',
      'id': 0,
      'provider': {
        type: 'smoldot',
        spec: './chain-specs/rococo-local.json'
      }
    },
    {
      'name': 'local',
      'id': 1000,
      'relay': 'rococo_local_testnet',
      'provider': {
        'type': 'smoldot',
        'spec': './chain-specs/rococo-local-asset-hub-kusama-local_1000.json'
      }
    }
  ]
} as ServiceConfiguration;