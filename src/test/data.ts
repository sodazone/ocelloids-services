import { QuerySubscription } from '../services/monitoring/types.js';

export const _subsFix : QuerySubscription[] = [
  {
    id: '0:1000:1',
    origin: 0,
    destinations: [
      1000
    ],
    senders: ['a', 'b', 'c'],
    notify: {
      type: 'log'
    }
  },
  {
    id: '0:1000:2',
    origin: 0,
    destinations: [
      1000
    ],
    senders: ['d', 'e', 'f'],
    notify: {
      type: 'log'
    }
  },
  {
    id: '0:2000:1',
    origin: 0,
    destinations: [
      2000
    ],
    senders: ['a', 'b', 'c'],
    notify: {
      type: 'log'
    }
  },
  {
    id: '100:0-2000:1',
    origin: 1000,
    destinations: [
      0, 2000
    ],
    senders: ['a', 'b', 'c'],
    notify: {
      type: 'log'
    }
  },
  {
    id: '100:0-2000:2',
    origin: 1000,
    destinations: [
      0, 2000
    ],
    senders: ['d', 'e', 'f'],
    notify: {
      type: 'log'
    }
  },
];

export const _configToml = `
[[networks]]
id = 0
name = "local_relay"

  [networks.provider]
  type = "rpc"
  url = "ws://localhost:9000"

[[networks]]
id = 1_000
name = "local_1"
relay = "local_reay"

  [networks.provider]
  type = "rpc"
  url = "ws://localhost:9001"

[[networks]]
id = 2_000
name = "local_2000"
relay = "local_reay"

  [networks.provider]
  type = "rpc"
  url = "ws://localhost:9002"

[[networks]]
id = 3_000
name = "local_3000"
relay = "local_reay"

  [networks.provider]
  type = "rpc"
  url = "ws://localhost:9003"
`;
