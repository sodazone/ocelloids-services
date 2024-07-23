import { Subscription } from '../services/subscriptions/types.js'

export const _testAgentId = 'agent-mcmuffin'
export const _subsFix: Subscription[] = [
  {
    id: '0:1000:1',
    agent: _testAgentId,
    owner: 'unknown',
    args: {
      origin: 'urn:ocn:local:0',
      destinations: ['urn:ocn:local:1000'],
      senders: ['a', 'b', 'c'],
    },
    channels: [
      {
        type: 'log',
      },
    ],
  },
  {
    id: '0:1000:2',
    agent: _testAgentId,
    owner: 'unknown',
    args: {
      origin: 'urn:ocn:local:0',
      destinations: ['urn:ocn:local:1000'],
      senders: ['d', 'e', 'f'],
    },
    channels: [
      {
        type: 'log',
      },
    ],
  },
  {
    id: '0:2000:1',
    agent: _testAgentId,
    owner: 'unknown',
    args: {
      origin: 'urn:ocn:local:0',
      destinations: ['urn:ocn:local:2000'],
      senders: ['a', 'b', 'c'],
    },
    channels: [
      {
        type: 'log',
      },
    ],
  },
  {
    id: '100:0-2000:1',
    agent: _testAgentId,
    owner: 'unknown',
    args: {
      origin: 'urn:ocn:local:1000',
      destinations: ['urn:ocn:local:0', 'urn:ocn:local:2000'],
      senders: ['a', 'b', 'c'],
    },
    channels: [
      {
        type: 'log',
      },
    ],
  },
  {
    id: '100:0-2000:2',
    agent: _testAgentId,
    owner: 'unknown',
    args: {
      origin: 'urn:ocn:local:1000',
      destinations: ['urn:ocn:local:0', 'urn:ocn:local:2000'],
      senders: ['d', 'e', 'f'],
    },
    channels: [
      {
        type: 'log',
      },
    ],
  },
]

export const _configToml = `
[[networks]]
id = "urn:ocn:local:0"

  [networks.provider]
  type = "rpc"
  url = "ws://localhost:9000"

[[networks]]
id = "urn:ocn:local:1000"
relay = "urn:ocn:local:0"

  [networks.provider]
  type = "rpc"
  url = "ws://localhost:9001"

[[networks]]
id = "urn:ocn:local:2000"
relay = "urn:ocn:local:0"

  [networks.provider]
  type = "rpc"
  url = "ws://localhost:9002"

[[networks]]
id = "urn:ocn:local:3000"
relay = "urn:ocn:local:0"

  [networks.provider]
  type = "rpc"
  url = "ws://localhost:9003"

[[networks]]
id = "urn:ocn:wococo:0"

  [networks.provider]
  type = "rpc"
  url = "ws://localhost:8000"

[[networks]]
id = "urn:ocn:wococo:1000"
relay = "urn:ocn:wococo:0"

  [networks.provider]
  type = "rpc"
  url = "ws://localhost:8001"

[[networks]]
id = "urn:ocn:wococo:1002"
relay = "urn:ocn:wococo:0"

  [networks.provider]
  type = "rpc"
  url = "ws://localhost:8002"

[[networks]]
id = "urn:ocn:paseo:0"

  [networks.provider]
  type = "rpc"
  url = "ws://localhost:6000"
`

export const jwtSigKey = `
  {
    "use":"sig",
    "kty":"OKP",
    "kid":"y27ec-ZpjEcWSAbGz6zt_08nWkJ18Db21vLKlwkLxSY=",
    "crv":"Ed25519",
    "alg":"EdDSA",
    "d": "OrUxD8lEjqIu7Rhi_Wo590NOTMNGYM3kMlETMSimFZc",
    "x": "O6ljryhfUImIYY05ZsbEehfKE-YXu3e_FSV0CqZr-9s"
  }
`

export const rootToken =
  'eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJqdGkiOiIwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMCIsInN1YiI6InJvb3RAb2NlbGxvaWRzIiwiaXNzIjoidGVzdCIsImlhdCI6MTcyMTczMzkxN30.nBuCOzUYl4ABOBg8A52ga9R5DUYtx8XdkU_xHlGzy_DMnIhA9qRDZFSzCund3qxQo_Jcv_iB9JZL-7M-5TD7Aw'
export const publicToken =
  'eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJqdGkiOiIwMTAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMCIsInN1YiI6InB1YmxpY0BvY2VsbG9pZHMiLCJpc3MiOiJ0ZXN0IiwiaWF0IjoxNzIxNjQ2NjE5fQ.eD5EBUclmJp6oyLS_FECuZxUDr_QUp5ISqzTu4H6LiOq_fjLZFJoWdfRZLpGnp5AgOI7rO7LpeiV60wMePW9Aw'
export const invalidToken =
  'eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJqdGkiOiIwMTAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMCIsInN1YiI6Im1hY2FyaW8iLCJpc3MiOiJ0ZXN0IiwiaWF0IjoxNzIxNjQ2NjE5fQ.TR6eH5XPxSG-fboGrMjlUAzeUL3zyUifu56DK2_bssU8nUKXXacUhvCeLW6zdsuTFAq6gm5rRL9pvbp0n8I2Bg'
