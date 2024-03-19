import { Subscription } from '../services/monitoring/types.js';

export const _subsFix: Subscription[] = [
  {
    id: '0:1000:1',
    origin: 'urn:ocn:local:0',
    destinations: ['urn:ocn:local:1000'],
    senders: ['a', 'b', 'c'],
    channels: [
      {
        type: 'log',
      },
    ],
  },
  {
    id: '0:1000:2',
    origin: 'urn:ocn:local:0',
    destinations: ['urn:ocn:local:1000'],
    senders: ['d', 'e', 'f'],
    channels: [
      {
        type: 'log',
      },
    ],
  },
  {
    id: '0:2000:1',
    origin: 'urn:ocn:local:0',
    destinations: ['urn:ocn:local:2000'],
    senders: ['a', 'b', 'c'],
    channels: [
      {
        type: 'log',
      },
    ],
  },
  {
    id: '100:0-2000:1',
    origin: 'urn:ocn:local:1000',
    destinations: ['urn:ocn:local:0', 'urn:ocn:local:2000'],
    senders: ['a', 'b', 'c'],
    channels: [
      {
        type: 'log',
      },
    ],
  },
  {
    id: '100:0-2000:2',
    origin: 'urn:ocn:local:1000',
    destinations: ['urn:ocn:local:0', 'urn:ocn:local:2000'],
    senders: ['d', 'e', 'f'],
    channels: [
      {
        type: 'log',
      },
    ],
  },
];

export const _configToml = `
[[networks]]
id = "urn:ocn:local:0"
name = "local_relay"

  [networks.provider]
  type = "rpc"
  url = "ws://localhost:9000"

[[networks]]
id = "urn:ocn:local:1000"
name = "local_1"
relay = "local_reay"

  [networks.provider]
  type = "rpc"
  url = "ws://localhost:9001"

[[networks]]
id = "urn:ocn:local:2000"
name = "local_2000"
relay = "local_reay"

  [networks.provider]
  type = "rpc"
  url = "ws://localhost:9002"

[[networks]]
id = "urn:ocn:local:3000"
name = "local_3000"
relay = "local_reay"

  [networks.provider]
  type = "rpc"
  url = "ws://localhost:9003"
`;
